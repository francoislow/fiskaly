const express = require('express');
const router = express.Router();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const makeDBRequest = require("../db");
const qr = require('qr-image');
const fs = require('fs');
const nodeHtmlToImage = require('node-html-to-image');
const path = require("path");

router.post('/start', async(req, res, next) => {

    //let tssID = "a4724605-7fc3-400e-aa26-e5f1f9b10af0";
    const clientGUID = req.body.clientGuid;
    const registerName = req.body.registerName;
    const registerID = req.body.registerId;
    const outlet = req.body.outlet;
    const txID = uuidv4();
    let revision = 1;
    const totalAmt = req.body.totalAmt;
    const totalTax = req.body.totalTax;
    const currency = req.body.currency;

    let getCredentials;
    try {
        getCredentials = await makeDBRequest(
            "SELECT * FROM fiskalycredentials WHERE client_guid=$1;", 
            [clientGUID]
        )
    } catch(e) {
        return res.status(500).send({status: 500, msg: "Auth failed - Fail to get credentials.", error: e.detail});
    }

    if (getCredentials.rowCount === 0) {
        return res.status(500).send({status: 500, msg: "Auth failed - Fail to get credentials."});
    }
    const apiKey = getCredentials.rows[0].api_key;
    const apiSecret = getCredentials.rows[0].api_secret;

    let getTSSDetails;
    try {
        getTSSDetails = await makeDBRequest(
            "SELECT * FROM fiskalytssdetails WHERE client_guid=$1 AND outlet=$2;", 
            [clientGUID, outlet]
        )
    } catch(e) {
        return res.status(500).send({status: 500, msg: "Fail to get tss details.", error: e.detail});
    }

    if (getTSSDetails.rowCount === 0) {
        return res.status(500).send({status: 500, msg: "Fail to get tss details, no tss found."});
    }

    const tssID = getTSSDetails.rows[0].tss_id;

    let getClientDetails;
    try {
        getClientDetails = await makeDBRequest(
            "SELECT * FROM fiskalyclients WHERE client_guid=$1 AND register_id=$2;", 
            [clientGUID, registerID]
        )
    } catch(e) {
        return res.status(500).send({status: 500, msg: "Fail to get client details.", error: e.detail});
    }

    if (getClientDetails.rowCount === 0) {
        return res.status(500).send({status: 500, msg: "Fail to get client details, no client found."});
    }

    const clientID = getClientDetails.rows[0].client_id;
    const clientSerialNum = getClientDetails.rows[0].client_serial;

    let authConfig = {
        method: 'post',
        url: 'https://kassensichv-middleware.fiskaly.com/api/v2/auth',
        headers: { 
            'Content-Type': 'application/json'
        },
        data : JSON.stringify({
            "api_key": apiKey,
            "api_secret": apiSecret
        })
    };
    // AUTH API CALL
    axios(authConfig)
    .then((response) => {
        
        const accessToken = response.data.access_token;

        let startTransConfig = {
            method: 'put',
            url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}/tx/${txID}?tx_revision=${revision}`,
            headers: { 
                'Authorization': `Bearer ${accessToken}`, 
                'Content-Type': 'application/json'
            },
            data : {
                "state": "ACTIVE",
                "client_id": clientID
            }
        };

        axios(startTransConfig)
        .then(async (response) => {

            let insertTrans;
            try {
                insertTrans = await makeDBRequest(
                    "INSERT INTO fiskalytransactions VALUES($1, $2, $3, $4, $5, $6, $7, $8);", 
                    [response.data._id, response.data.tss_id, response.data.client_id, response.data.revision, totalAmt, totalTax, clientGUID, registerName]
                )
            } catch(e) {
                return res.status(500).send({status: 500, msg: "Fail to insert transaction into db.", error: e.detail});
            }

            if (insertTrans.rowCount === 0) {
                return res.status(500).send({status: 500, msg: "Fail to insert transaction into db."});
            }

            console.log("insertTrans.rowCount: ", insertTrans.rowCount);

            return res.status(200).send({status_code: 200, start_trans_details: response.data});

        }).catch((error) => {
            console.log("Start trans error: ", error);
            return res.status(500).send({status_code: 200, start_trans_details: response.data});
        })
        

    }).catch((error) => {
        console.log("Auth failed: ", error);
        return res.status(500).send({status_code: 500, msg: "Auth failed." ,error: error.detail});
    })

    
});

router.post('/finish', async (req, res, next) => {

    let txID = req.body.txId;
    let clientGUID = req.body.clientGuid;
    let registerName = req.body.registerName;
    let clientID = req.body.clientId;
    let payments = req.body.payments;
    let paymentsArr = [];
    for (let i = 0; i < payments.length; i++){
        if (payments[i].type == "cash"){
            paymentsArr.push({
                "payment_type": "CASH",
                "amount": (payments[i].amount / 100).toFixed(2)
            });
        }else{
            paymentsArr.push({
                "payment_type": "NON_CASH",
                "amount": (payments[i].amount / 100).toFixed(2)
            });
        }
    }

    let getCredentials;
    try {
        getCredentials = await makeDBRequest(
            "SELECT * FROM fiskalycredentials WHERE client_guid=$1;", 
            [clientGUID]
        )
    } catch(e) {
        return res.status(500).send({status: 500, msg: "Auth failed - Fail to get credentials.", error: e.detail});
    }

    if (getCredentials.rowCount === 0) {
        return res.status(500).send({status: 500, msg: "Auth failed - Fail to get credentials."});
    }
    const apiKey = getCredentials.rows[0].api_key;
    const apiSecret = getCredentials.rows[0].api_secret;

    let getTrans;
    try {
        getTrans = await makeDBRequest(
            "SELECT * FROM fiskalytransactions WHERE client_guid=$1 AND register_name=$2 AND tx_id=$3;", 
            [clientGUID, registerName, txID]
        )
    } catch(e) {
        return res.status(500).send({status: 500, msg: "Failed to fetch transaction from db.", error: e.detail});
    }

    if (getTrans.rowCount === 0) {
        return res.status(500).send({status: 500, msg: "Failed to fetch transaction from db."});
    }
    
    const tssID = getTrans.rows[0].tss_id;
    const currentRevision = getTrans.rows[0].revision + 1;
    const totalAmt = getTrans.rows[0].total_amt;
    const totalTax = getTrans.rows[0].total_tax;

    let authConfig = {
        method: 'post',
        url: 'https://kassensichv-middleware.fiskaly.com/api/v2/auth',
        headers: { 
            'Content-Type': 'application/json'
        },
        data : JSON.stringify({
            "api_key": apiKey,
            "api_secret": apiSecret
        })
    };
    // AUTH API CALL
    axios(authConfig)
    .then((response) => {

        const accessToken = response.data.access_token;

        let finishTransConfig = {
            method: 'put',
            url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}/tx/${txID}?tx_revision=${currentRevision}`,
            headers: { 
              'Authorization': `Bearer ${accessToken}`, 
              'Content-Type': 'application/json'
            },
            data : JSON.stringify({
                "state": "FINISHED",
                "client_id": clientID,
                "schema": {
                    "standard_v1": {
                    "receipt": {
                        "receipt_type": "RECEIPT",
                        "amounts_per_vat_rate": [
                            {
                                "vat_rate": "NORMAL",
                                "amount": totalTax
                            }
                        ],
                        "amounts_per_payment_type": paymentsArr
                    }
                    }
                }
            })
        };

        axios(finishTransConfig)
        .then((response) => {
            return res.status(200).send({status_code: 200, finish_trans_details: response.data});
        }).catch((error) => {
            console.log("Finish trans failed: ", error);
            return res.status(500).send({status_code: 500, msg: "Finish trans failed."});
        });


    }).catch((error) => {
        console.log("Auth failed: ", error);
        return res.status(500).send({status_code: 500, msg: "Auth failed."});
    })



    
  

});

router.post('/cancel', function(req, res, next) {

    let txID = req.body.tx_id;
    let tssID = req.body.tss_id;
    let clientID = req.body.client_id;
    let apiKey = req.body.api_key;
    let apiSecret = req.body.api_secret;
    let currentRevision = req.body.revision;

    console.log("CURRENT REVISION: ", currentRevision);

    let authData = JSON.stringify({
        "api_key": apiKey,
        "api_secret": apiSecret
    });
    
    let authConfig = {
        method: 'post',
        url: 'https://kassensichv-middleware.fiskaly.com/api/v2/auth',
        headers: { 
            'Content-Type': 'application/json'
        },
        data : authData
    };
    
    axios(authConfig)
    .then(function (response) {

        bearerAuth = `Bearer ${response.data.access_token}`;

        let cancelTransData = JSON.stringify({
            "state": "CANCELLED",
            "client_id": clientID,
            "schema": {
              "standard_v1": {
                "receipt": {
                  "receipt_type": "RECEIPT",
                  "amounts_per_vat_rate": [
                    {
                      "vat_rate": "NORMAL",
                      "amount": "3.50"
                    }
                  ],
                  "amounts_per_payment_type": [
                    {
                      "payment_type": "CASH",
                      "amount": "10.00"
                    }
                  ]
                }
              }
            }
          });
          
        let cancelTransConfig = {
            method: 'put',
            url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}/tx/${txID}?tx_revision=${currentRevision}`,
            headers: { 
                'Authorization': bearerAuth, 
                'Content-Type': 'application/json'
            },
            data : cancelTransData
        };
        
        axios(cancelTransConfig)
        .then(function (response) {
            console.log("CANCEL TRANSACTION RESPONSE: ", response.data);
            res.send({"response": response.data});
        })
        .catch(function (error) {
            console.log(error);
        });
    })
    .catch(function(error){
        console.log(error);
    });
    


});


router.post('/image/upload', async(req, res) => {
    const clientGuid = req.body.clientGuid;
    //const html = req.body.html;
    const qrData = req.body.qrData;
    const qrImg = qr.image(qrData, { type: 'png' });
    qrImg.pipe(fs.createWriteStream(`./qr_code/${clientGuid}.png`))
    return res.send({status_code: 200, msg: "Qr Data received!"});

})

router.get('/image/fetch', async(req, res) => {
    const clientGuid = req.query.clientGuid;

    if (!clientGuid) {
        return res.sendStatus(404);
    }
    const file = path.resolve(`qr_code/${clientGuid}.png`);

    res.sendFile(file, (err) => {
        if (err) {
            res.sendStatus(404);
        } else {
            try {
                fs.unlinkSync(file);
            } catch (e) {
                console.log(e);
            }
        }
    });
})

module.exports = router;
