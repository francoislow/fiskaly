const express = require('express');
const router = express.Router();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const makeDBRequest = require("../db");

let bearerAuth;
let clientCount;
let clientList;

router.post('/onboard', (req, res, next) => {
    const apiKey = req.body.apiKey;
    const apiSecret =  req.body.apiSecret;
    const clientGUID = req.body.clientGuid;

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
    // AUTH API CALL
    axios(authConfig)
    .then(async(response) => {
        
        // console.log(response.data);
        let accessToken = response.data.access_token;
        let addCredentials;
        try {
            addCredentials = await makeDBRequest(
                "INSERT INTO fiskalycredentials VALUES($1, $2, $3);", 
                [clientGUID, apiKey, apiSecret]
            )
        } catch(e) {
            return res.send({status_code: 500, msg: "Fail to add API credentials into db.", error: e.detail});
        }

        if (addCredentials.rowCount === 0) {
            return res.send({status_code: 500, msg: "API credentials not added into db."});
        }

        return res.send({status_code: 200, msg: "Registration is successful."});

    }).catch((error) => {
        console.log("AUTH API CALL failed: ", error);
        return res.send({status_code: 500, msg: "Failed to authenticate with given API credentials."});
    })

})




router.post('/authenticate', async(req, res, next) => {
    // let apiKey = req.body.apiKey;
    // let apiSecret =  req.body.apiSecret;
    let clientGUID = req.body.clientGuid;
    console.log("clientGUID from /authenticate: ", clientGUID);
    

    let getCredentials;
    try {
        getCredentials = await makeDBRequest(
            "SELECT * FROM fiskalycredentials WHERE client_guid=$1;", 
            [clientGUID]
        )
    } catch(e) {
        return res.send({status: 500, msg: "Auth failed - Fail to get credentials.", error: e.detail});
    }

    if (getCredentials.rowCount === 0) {
        return res.send({status: 500, msg: "Auth failed - Fail to get credentials."});
    }
    const apiKey = getCredentials.rows[0].api_key;
    const apiSecret = getCredentials.rows[0].api_secret;

    console.log("apiKey: ", apiKey);
    console.log("apiSecret: ", apiSecret);
    
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
    // AUTH API CALL
    axios(authConfig)
    .then(function (response) {
        
        // console.log(response.data);
        let accessToken = response.data.access_token;

        bearerAuth = `Bearer ${accessToken}`;
        

        let listTSSConfig = {
            method: 'get',
            url: 'https://kassensichv-middleware.fiskaly.com/api/v2/tss?order_by=time_creation&order=desc',
            headers: { 
                'Authorization': bearerAuth, 
                'Content-Type': 'application/json'
            },
            data : JSON.stringify({})
        };
        // LIST TSS API CALL
        axios(listTSSConfig)
        .then(function (response) {
            
            let dataList = response.data.data;
            let tssList = [];
            
            for (let i = 0; i < dataList.length; i++){
                if (dataList[i].state == "INITIALIZED"){
                    tssList.push(dataList[i]);
                }
            }
            console.log("/authenticate CLIENT GUID: ", clientGUID);
            res.status(200).send({client_guid: clientGUID, status_code: 200, tssList: tssList});


        })
        .catch(function (error) {
            console.log(error);
            res.status(500).send({api_key: apiKey, api_secret: apiSecret, client_guid: clientGUID, authCredentialsRes: "LIST TSS FAILED!", createTSSRes: "", disableTSSRes: "", retrieveTSSRes: "",  status_code: 200, tssList: [], admin_pin: '', tssInfo: ''});
        });
        
        
    })
    .catch(err => {
        res.status(500).send({api_key: apiKey, api_secret: apiSecret, client_guid: clientGUID, authCredentialsRes: "AUTHENTICATION FAILED!", createTSSRes: "", disableTSSRes: "", retrieveTSSRes: "", status_code: 500, tssList: [], admin_pin: '', tssInfo: ''});
    });
    

});

router.post('/removeAccount', function (req, res, next) {

    // PLACE LOGIC HERE FOR REMOVING ACCOUNT FROM POSTGRES DB

    res.render('index', {
        authCredentialsRes: '',
        api_key: '',
        api_secret: '',
        status_code: 500,
        tssList: [], 
        admin_pin: ''
    });
});

router.post('/createTSS', async (req, res, next) => {
    
    const clientGUID = req.body.clientGuid;
    const tssID = uuidv4();
    const outletName = req.body.outlet;
    const adminPin = clientGUID.substr(clientGUID.length - 8);

    console.log("clientGUID: ", clientGUID);
    console.log("outletName: ", outletName);

    let getCredentials;
    try {
        getCredentials = await makeDBRequest(
            "SELECT * FROM fiskalycredentials WHERE client_guid=$1;", 
            [clientGUID]
        )
    } catch(e) {
        return res.send({status: 500, msg: "Auth failed - Fail to get credentials.", error: e.detail});
    }

    if (getCredentials.rowCount === 0) {
        return res.send({status: 500, msg: "Auth failed - Fail to get credentials."});
    }
    const apiKey = getCredentials.rows[0].api_key;
    const apiSecret = getCredentials.rows[0].api_secret;
    
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
        
       // console.log(response.data);
        const accessToken = response.data.access_token;
        let bearerAuth = `Bearer ${accessToken}`; 

        let createTSSConfig = {
            method: 'put',
            url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}`,
            headers: { 
                'Authorization': bearerAuth, 
                'Content-Type': 'application/json'
            },
            data : JSON.stringify({
                "metadata": {
                  "admin_pin": adminPin,
                  "client_guid": clientGUID,
                  "outlet_name": outletName
                }
            })
        };
        // CREATE TSS API CALL
        axios(createTSSConfig)
        .then(function (response) {
            console.log("CREATE TSS RESPONSE: ", response.data);
                
                const adminPuk = response.data.admin_puk;
                let state = response.data.state;

                console.log("ADMIN PUK:", adminPuk);
          
                console.log("STATE: ", state);
                if (state == "CREATED"){

                    let uninitTSSConfig = {
                        method: 'patch',
                        url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}`,
                        headers: { 
                          'Authorization': bearerAuth, 
                          'Content-Type': 'application/json'
                        },
                        data : JSON.stringify({
                            "state": "UNINITIALIZED"
                        })
                    };
                    
                    // UPDATE TSS API CALL (UNINITIALIZED)
                    axios(uninitTSSConfig)
                    .then(function (response) {
                        console.log("UNINIT response.data.state: ", response.data.state);
                        if (response.data.state == "UNINITIALIZED") {

                            console.log("UNINITIALIZED TSS RESPONSE:", response.data);
                            
                            let unblockAdminPinConfig = {
                                method: 'patch',
                                url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}/admin`,
                                headers: { 
                                    'Authorization': bearerAuth, 
                                    'Content-Type': 'application/json'
                                },
                                data : JSON.stringify({
                                    "admin_puk": adminPuk,
                                    "new_admin_pin": adminPin
                                })
                            };


                            // UNBLOCK ADMIN PIN API CALL
                            axios(unblockAdminPinConfig)
                            .then((response) => {
                                console.log("UNBLOCK ADMIN PIN EXECUTED");
                                
                                let authAdminConfig = {
                                    method: 'post',
                                    url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}/admin/auth`,
                                    headers: { 
                                        'Authorization': bearerAuth, 
                                        'Content-Type': 'application/json'
                                    },
                                    data : JSON.stringify({
                                        "admin_pin": adminPin
                                    })
                                };

                                axios(authAdminConfig)
                                .then((response) => {
                                    console.log("ADMIN AUTH COMPLETED");
                                    
                                    let initializeTSSConfig = {
                                        method: 'patch',
                                        url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}`,
                                        headers: { 
                                            'Authorization': bearerAuth, 
                                            'Content-Type': 'application/json'
                                        },
                                        data : JSON.stringify({
                                            "state": "INITIALIZED"
                                        })
                                    };
                                    
                                    axios(initializeTSSConfig)
                                    .then((response) => {
                                        console.log("INITIALIZED RESPONSE: ", response.data);
                                        if (response.data.state == "INITIALIZED"){

                                            let listTSSConfig = {
                                                method: 'get',
                                                url: 'https://kassensichv-middleware.fiskaly.com/api/v2/tss?order_by=time_creation&order=desc',
                                                headers: { 
                                                    'Authorization': bearerAuth, 
                                                    'Content-Type': 'application/json'
                                                },
                                                data : JSON.stringify({})
                                            };
                                            // LIST TSS API CALL
                                            axios(listTSSConfig)
                                            .then(async (response) => {

                                                let dataList = response.data.data;
                                                let tssList = [];
                                
                                                for (let i = 0; i < dataList.length; i++){
                                                    if (dataList[i].state == "INITIALIZED"){
                                                        tssList.push(dataList[i]);
                                                    }
                                                }

                                                let recordTSS;
                                                try {
                                                    recordTSS = await makeDBRequest(
                                                        `INSERT INTO fiskalytssdetails(tss_id, client_guid, admin_puk, admin_pin, outlet) VALUES ($1, $2, $3, $4, $5);`, 
                                                        [tssID, clientGUID,  adminPuk, adminPin, outletName]
                                                    )
                                                } catch(e) {
                                                    return res.status(500).send({status: 500, msg: "Record TSS failed - Fail to add TSS to db."});
                                                }

                                                if (recordTSS.rowCount === 0) {
                                                    return res.status(500).send({status: 500, msg: "Record TSS failed - Fail to add TSS to db."});
                                                }
               
                                                return res.status(200).send({status_code: 200, tssList: tssList});

                                            })
                                            .catch((error) => {
                                                return res.status(200).send({msg: "Failed to retrieve TSS list.", status_code: 500, tssList: []});
                                            });
                                            


                                        }else{
                                            return res.status(500).send({msg: "TSS not initialized.", status_code: 500, tssList: []});
                                        }
                                    })
                                    // TSS INITIALIZATION FAILURE
                                    .catch((error) => {

                                        let listTSSConfig = {
                                            method: 'get',
                                            url: 'https://kassensichv-middleware.fiskaly.com/api/v2/tss?order_by=time_creation&order=desc',
                                            headers: { 
                                                'Authorization': bearerAuth, 
                                                'Content-Type': 'application/json'
                                            },
                                            data : JSON.stringify({})
                                        };
                                        // LIST TSS API CALL
                                        axios(listTSSConfig)
                                        .then((response) => {

                                            let dataList = response.data.data;
                                            let tssList = [];
                            
                                            for (let i = 0; i < dataList.length; i++){
                                                if (dataList[i].state == "INITIALIZED"){
                                                    tssList.push(dataList[i]);
                                                }
                                            }

                                            return res.status(500).send({msg: "Failed to initialize TSS.", status_code: 500, tssList: tssList});
                            
                                        })
                                        .catch((error) => {
                                            return res.status(500).send({msg: "Failed to initialize TSS and retrieve TSS list.", status_code: 500, tssList: []});
                                        });

                                    });
                                })
                                // AUTH ADMIN FAILURE
                                .catch((error) => {
                                    console.log("AUTH ADMIN REQUEST: ", error);

                                    let listTSSConfig = {
                                        method: 'get',
                                        url: 'https://kassensichv-middleware.fiskaly.com/api/v2/tss?order_by=time_creation&order=desc',
                                        headers: { 
                                            'Authorization': bearerAuth, 
                                            'Content-Type': 'application/json'
                                        },
                                        data : JSON.stringify({})
                                    };
                                    // LIST TSS API CALL
                                    axios(listTSSConfig)
                                    .then((response) => {

                                        let dataList = response.data.data;
                                        let tssList = [];
                        
                                        for (let i = 0; i < dataList.length; i++){
                                            if (dataList[i].state == "INITIALIZED"){
                                                tssList.push(dataList[i]);
                                            }
                                        }

                                        return res.status(500).send({msg: "Sign in failed using admin pin.", status_code: 500, tssList: tssList});
                                    })
                                    .catch(function (error) {
                                        console.log(error);
                                        return res.status(500).send({msg: "Sign in failed using admin pin, failed to retrieve TSS list.", status_code: 500, tssList: []});
                                    });
                                    
                                });

                            })
                            // UNBLOCK ADMIN PIN FAILURE
                            .catch((error) => {
                                console.log("UNBLOCK ADMIN PIN REQUEST: ", error);

                                let listTSSConfig = {
                                    method: 'get',
                                    url: 'https://kassensichv-middleware.fiskaly.com/api/v2/tss?order_by=time_creation&order=desc',
                                    headers: { 
                                        'Authorization': bearerAuth, 
                                        'Content-Type': 'application/json'
                                    },
                                    data : JSON.stringify({})
                                };
                                // LIST TSS API CALL
                                axios(listTSSConfig)
                                .then(function (response) {

                                    let dataList = response.data.data;
                                    let tssList = [];
                    
                                    for (let i = 0; i < dataList.length; i++){
                                        if (dataList[i].state == "INITIALIZED"){
                                            tssList.push(dataList[i]);
                                        }
                                    }

                                    return res.status(500).send({msg: "Failed to unblock admin pin", status_code: 500, tssList: tssList});
                                })
                                .catch(function (error) {
                                    console.log(error);
                                    return res.status(500).send({msg: "Failed to unblock admin pin, failed to retrieve TSS list.", status_code: 500, tssList: []});
                                });

                            });
                        
                        // TSS STATE FAIL TO BE UNINITIALIZED
                        }else{

                            let listTSSConfig = {
                                method: 'get',
                                url: 'https://kassensichv-middleware.fiskaly.com/api/v2/tss?order_by=time_creation&order=desc',
                                headers: { 
                                    'Authorization': bearerAuth, 
                                    'Content-Type': 'application/json'
                                },
                                data : JSON.stringify({})
                            };
                            // LIST TSS API CALL
                            axios(listTSSConfig)
                            .then(function (response) {

                                let dataList = response.data.data;
                                let tssList = [];
                
                                for (let i = 0; i < dataList.length; i++){
                                    if (dataList[i].state == "INITIALIZED"){
                                        tssList.push(dataList[i]);
                                    }
                                }
                                return res.status(500).send({msg: "Failed to uninitialized TSS", status_code: 500, tssList: tssList});
                            })
                            .catch((error) => {
                                return res.status(500).send({msg: "Failed to uninitialized TSS, failed to retrieve TSS list.", status_code: 500, tssList: tssList});
                            }); 
                        }
                    })
                    // TSS UNINTIALIZATION FAILURE
                    .catch((error) => {

                        let listTSSConfig = {
                            method: 'get',
                            url: 'https://kassensichv-middleware.fiskaly.com/api/v2/tss?order_by=time_creation&order=desc',
                            headers: { 
                                'Authorization': bearerAuth, 
                                'Content-Type': 'application/json'
                            },
                            data : JSON.stringify({})
                        };
                        // LIST TSS API CALL
                        axios(listTSSConfig)
                        .then(function (response) {

                            let dataList = response.data.data;
                            let tssList = [];
            
                            for (let i = 0; i < dataList.length; i++){
                                if (dataList[i].state == "INITIALIZED"){
                                    tssList.push(dataList[i]);
                                }
                            }
                            return res.send({msg: "Failed to update TSS state", status_code: 500, tssList: tssList});
                        })
                        .catch(function (error) {
                            console.log(error);
                            return res.send({msg: "Failed to update TSS state, failed to retrieve TSS list", status_code: 500, tssList: []});
                        }); 

                    });

                // TSS STATE IS NOT "CREATED"
                }else{

                    let listTSSConfig = {
                        method: 'get',
                        url: 'https://kassensichv-middleware.fiskaly.com/api/v2/tss?order_by=time_creation&order=desc',
                        headers: { 
                            'Authorization': bearerAuth, 
                            'Content-Type': 'application/json'
                        },
                        data : JSON.stringify({})
                    };
                    // LIST TSS API CALL
                    axios(listTSSConfig)
                    .then(function (response) {

                        let dataList = response.data.data;
                        let tssList = [];
        
                        for (let i = 0; i < dataList.length; i++){
                            if (dataList[i].state == "INITIALIZED"){
                                tssList.push(dataList[i]);
                            }
                        }
                        return res.send({msg: "Failed to create TSS.", status_code: 500, tssList: tssList});
                    })
                    .catch(function (error) {
                        console.log(error);
                        return res.send({msg: "Failed to create TSS, failed to retrieve TSS list.", status_code: 500, tssList: []});
                    });
                }

        })// CREATE TSS API REQUEST FAILURE
        .catch((error) => {

            let listTSSConfig = {
                method: 'get',
                url: 'https://kassensichv-middleware.fiskaly.com/api/v2/tss?order_by=time_creation&order=desc',
                headers: { 
                    'Authorization': bearerAuth, 
                    'Content-Type': 'application/json'
                },
                data : JSON.stringify({})
            };
            // LIST TSS API CALL
            axios(listTSSConfig)
            .then((response) => {

                let dataList = response.data.data;
                let tssList = [];

                for (let i = 0; i < dataList.length; i++){
                    if (dataList[i].state == "INITIALIZED"){
                        tssList.push(dataList[i]);
                    }
                }
                return res.send({msg: "Failed to create TSS.", status_code: 500, tssList: tssList});
            })
            .catch((error) => {
                console.log(error);
                return res.send({msg: "Failed to create TSS, failed to retrieve TSS list.", status_code: 500, tssList: []});
            });

        });
        
    })// CREDENTIALS AUTH FAILURE
    .catch((error) => {
        return res.send({msg: "Failed to authenticate.", status_code: 500, tssList: []});
    });

});

router.post('/disableTSS', async (req, res, next) => {
    const clientGUID = req.body.clientGuid;
    const tssID = req.body.tssId;
    let getCredentials;
    try {
        getCredentials = await makeDBRequest(
            "SELECT * FROM fiskalycredentials WHERE client_guid=$1;", 
            [clientGUID]
        )
    } catch(e) {
        return res.status(500).send({status_code: 500, msg: "Auth failed - Fail to get credentials."});
    }

    if (getCredentials.rowCount === 0) {
        return res.status(500).send({status_code: 500, msg: "Auth failed - Fail to get credentials."});
    }
    const apiKey = getCredentials.rows[0].api_key;
    const apiSecret = getCredentials.rows[0].api_secret;

    let getTSSDetails;
    try {
        getTSSDetails = await makeDBRequest(
            "SELECT * FROM fiskalytssdetails WHERE client_guid=$1 AND tss_id=$2;", 
            [clientGUID, tssID]
        )
    } catch(e) {
        return res.status(500).send({status_code: 500, msg: "Auth failed - Fail to get credentials."});
    }

    if (getTSSDetails.rowCount === 0) {
        return res.status(500).send({status_code: 500, msg: "Auth failed - Fail to get credentials."});
    }

    const adminPin = getTSSDetails.rows[0].admin_pin;
    
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
    
    axios(authConfig)
    .then((response) => {
       // console.log(response.data);
        const accessToken = response.data.access_token;
        
        let authAdminConfig = {
            method: 'post',
            url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}/admin/auth`,
            headers: { 
                'Authorization': `Bearer ${accessToken}`, 
                'Content-Type': 'application/json'
            },
            data : JSON.stringify({
                "admin_pin": adminPin
            })
        };
        
        axios(authAdminConfig)
        .then((response) => {
            console.log("DISABLE TSS BLOCK");
            let disableTSSData = JSON.stringify({
                "state": "DISABLED"
            });
   
            let disableTSSConfig = {
                method: 'patch',
                url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}`,
                headers: { 
                    'Authorization': `Bearer ${accessToken}`, 
                    'Content-Type': 'application/json'
                },
                data : disableTSSData
            };
            // DISABLE TSS API REQUEST
            axios(disableTSSConfig)
            .then((response) => {
                console.log(response.data);
                let state = response.data.state;
                console.log("DISABLE TSS RESPONSE STATE: ", state);

                if (state == 'DISABLED'){

                    let listTSSConfig = {
                        method: 'get',
                        url: 'https://kassensichv-middleware.fiskaly.com/api/v2/tss?order_by=time_creation&order=desc',
                        headers: { 
                            'Authorization': `Bearer ${accessToken}`, 
                            'Content-Type': 'application/json'
                        },
                        data : JSON.stringify({})
                    };

                    // LIST TSS API CALL
                    
                    axios(listTSSConfig)
                    .then(async (response) => {

                        let dataList = response.data.data;
                        let tssList = [];
        
                        for (let i = 0; i < dataList.length; i++){
                            if (dataList[i].state == "INITIALIZED"){
                                tssList.push(dataList[i]);
                            }
                        }

                        let removeTSS;
                        try {
                            removeTSS = await makeDBRequest(
                                `DELETE FROM fiskalytssdetails WHERE client_guid=$1 AND tss_id=$2;`, 
                                [clientGUID, tssID]
                            )
                        } catch(e) {
                            return res.send({status_code: 500, msg: "Deletion failed - Fail to delete TSS.", error: e.detail});
                        }
                    
                        if (removeTSS.rowCount === 0) {
                            return res.send({status_code: 500, msg: "Auth failed - Fail to get credentials."});
                        }
                        

                        let listClientsonfig =  {
                            method: 'get',
                            url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}/client`,
                            headers: { 
                                Authorization: `Bearer ${accessToken}`
                            }
                        };
    
                        // LIST CLIENT OF A TSS API CALL
                        axios(listClientsonfig)
                        .then(async (response) => {
                            let clients = response.data.data;
                            console.log("clients: ", clients);

                            for (let i = 0; i < clients.length; i++) {
                                let removeClients;
                                try {
                                    removeClients = await makeDBRequest(
                                        `DELETE FROM fiskalyclients WHERE client_guid=$1 AND client_id=$2 AND client_serial=$3;`, 
                                        [clientGUID, clients[i]._id, clients[i].serial_number]
                                    )
                                } catch(e) {
                                    return res.send({status_code: 500, msg: "Deletion failed - Fail to delete client.", error: e.detail});
                                }
                                if (removeClients.rowCount === 0) {
                                    return res.send({status_code: 500, msg: "Deletion failed - Fail to delete client."});
                                }
                            
                            }
                            return res.status(200).send({status_code: 200, tssList: tssList});

                        }).catch((error) => {
                            console.log("LIST CLIENTS OF A TSS FAILED: ", error);
                            return res.send({status_code: 500, msg: "Failed to retrieve clients from TSS."})
                        })

                    })
                    .catch((error) => {
                        console.log(error);
                        return res.status(500).send({status_code: 500, msg: "Failed to get TSS list."});
                    })
                    
                }else{
                    return res.status(500).send({status_code: 500, msg: "Failed to disable TSS."});
                }
            })
            // DISABLE TSS FAILURE
            .catch(function (error) {
                console.log(error);

                let listTSSConfig = {
                    method: 'get',
                    url: 'https://kassensichv-middleware.fiskaly.com/api/v2/tss?order_by=time_creation&order=desc',
                    headers: { 
                        'Authorization': `Bearer ${accessToken}`, 
                        'Content-Type': 'application/json'
                    },
                    data : JSON.stringify({})
                };
                // LIST TSS API CALL
                axios(listTSSConfig)
                .then(function (response) {
        
                    let dataList = response.data.data;
                    let tssList = [];
        
                    for (let i = 0; i < dataList.length; i++){
                        if (dataList[i].state == "INITIALIZED"){
                            tssList.push(dataList[i]);
                        }
                    }
                    return res.status(500).send({status_code: 500, tssList: tssList});
        
                })
                .catch(function (error) {
                    console.log(error);
                    return res.status(500).send({status_code: 500, tssList: [], msg: "Failed to disable TSS."});
                });
                
            });
                
        })
        // AUTH ADMIN FAILURE
        .catch(function (error) {
            console.log("AUTH ADMIN ERROR: ", error);

            let listTSSConfig = {
                method: 'get',
                url: 'https://kassensichv-middleware.fiskaly.com/api/v2/tss?order_by=time_creation&order=desc',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`, 
                    'Content-Type': 'application/json'
                },
                data : JSON.stringify({})
            };
            // LIST TSS API CALL
            axios(listTSSConfig)
            .then(function (response) {
    
                let dataList = response.data.data;
                let tssList = [];
    
                for (let i = 0; i < dataList.length; i++){
                    if (dataList[i].state == "INITIALIZED"){
                        tssList.push(dataList[i]);
                    }
                }
                return res.status(500).send({status_code: 500, tssList: tssList, msg: "Failed to auth admin."});
            })
            .catch(function (error) {
                console.log(error);
                return res.status(500).send({status_code: 500, tssList: [], msg: "Failed to auth admin."});
            });

        });

    })
    // CREDENTIALS AUTH FAILURE
    .catch(err => {
        console.log(err);
        return res.status(500).send({status_code: 500, tssList: [], msg: "Failed to authenticate with API credentials."});
    });
    
});



router.post('/getTSSTransactions', function (req, res, next) {

    let tssID = req.body.tssID;
    let adminPIN = req.body.adminPIN;
    let apiKey = req.body.apiKey;
    let apiSecret = req.body.apiSecret;
    let clientGUID = req.body.clientGUID;
    let outletName = req.body.outletName;

    // ADD LOGIC HERE TO RETREIVE API KEY AND API SECRET FROM POSTGRES DB AND API CALL TO OBTAIN BEARER TOKEN


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
        console.log(response.data);
        bearerAuth = `Bearer ${response.data.access_token}`;

        let listClientsConfig = {
            method: 'get',
            url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}/client`,
            headers: { 
                'Authorization': bearerAuth
            }
        };
        
        axios(listClientsConfig)
        .then(function (response) {
            console.log("LIST CLIENTS OF TSS RESPONSE: ", response.data);
            let dataList = response.data.data;
            let clientList = [];
            
            for (let i = 0; i < dataList.length; i++){
                if (dataList[i].state == "REGISTERED"){
                    clientList.push(dataList[i]);
                }
            }

            let listTransTSSConfig = {
                method: 'get',
                url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}/tx`,
                headers: { 
                  'Authorization': bearerAuth
                }
            };
            
            axios(listTransTSSConfig)
            .then(function (response) {
                console.log("LIST TRANS TSS RESPONSE: ", response.data);
                //res.render('clients',{clientList: clientList, tss_id: tssID, admin_pin: adminPIN, tssJSON: JSON.stringify(response.data,undefined, 2)});
                res.render('clients',{api_key: apiKey, api_secret: apiSecret, client_guid: clientGUID, clientList: clientList, outlet_name: outletName, tss_id: tssID, admin_pin: adminPIN, tssJSON: response.data, createClientRes: "", deregisterClientRes: "", tssSettingsRes: ""});
            })
            .catch(function (error) {
                console.log(error);
            });

            
            
        })
        .catch(function (error) {
            console.log(error);
        });

    })
    .catch(function (error) {
        console.log(error);
        res.render('index',{api_key: apiKey, api_secret: apiSecret, client_guid: clientGUID, authCredentialsRes: "AUTHENTICATION FAILED!", outlet_name: outletName, createTSSRes: "", disableTSSRes: "", retrieveTSSRes: "", status_code: 500, tssList: [], admin_pin: '', tssInfo: ''});
    });


});

router.post('/listExportTSS', function (req, res, next) {

    let tssID = req.body.tssID;
    let adminPIN = req.body.adminPIN;
    let apiKey = req.body.apiKey;
    let apiSecret = req.body.apiSecret;
    let clientGUID = req.body.clientGUID;
    let outletName = req.body.outletName;


    // ADD LOGIC HERE TO RETREIVE API KEY AND API SECRET FROM POSTGRES DB AND API CALL TO OBTAIN BEARER TOKEN

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
        console.log(response.data);
        bearerAuth = `Bearer ${response.data.access_token}`;

        let listClientsConfig = {
            method: 'get',
            url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}/client`,
            headers: { 
                'Authorization': bearerAuth
            }
        };
        
        axios(listClientsConfig)
        .then(function (response) {
            console.log("LIST CLIENTS OF TSS RESPONSE: ", response.data);
            let dataList = response.data.data;
            let clientList = [];
            
            for (let i = 0; i < dataList.length; i++){
                if (dataList[i].state == "REGISTERED"){
                    clientList.push(dataList[i]);
                }
            }

            let listExportsTSSConfig = {
                method: 'get',
                url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}/export`,
                headers: { 
                  'Authorization': bearerAuth
                }
            };
            
            axios(listExportsTSSConfig)
            .then(function (response) {
                console.log("LIST EXPORT TSS RESPONSE: ", response.data);
                //res.render('clients',{clientList: clientList, tss_id: tssID, admin_pin: adminPIN, tssJSON: JSON.stringify(response.data,undefined, 2)});
                res.render('clients',{api_key: apiKey, api_secret: apiSecret, client_guid: clientGUID, clientList: clientList, outlet_name: outletName, tss_id: tssID, admin_pin: adminPIN, tssJSON: response.data, createClientRes: "", deregisterClientRes: "", tssSettingsRes: ""});

            })
            //LIST EXPORT TSS FAILURE
            .catch(function (error) {
                console.log(error);
                res.render('clients',{api_key: apiKey, api_secret: apiSecret, client_guid: clientGUID, clientList: clientList, outlet_name: outletName, tss_id: tssID, admin_pin: adminPIN, tssJSON: "", createClientRes: "", deregisterClientRes: "", tssSettingsRes: "LIST EXPORT OF A TSS API REQUEST FAILED!"});
            });
              

        })
        // LIST CLIENTS FAILURE
        .catch(function(error) {
            console.log(error);
            res.render('clients',{api_key: apiKey, api_secret: apiSecret, client_guid: clientGUID, clientList: [], outlet_name: outletName, tss_id: tssID, admin_pin: adminPIN, tssJSON: "", createClientRes: "", deregisterClientRes: "", tssSettingsRes: "LIST CLIENTS API REQUEST FAILED!"});
        });

    })
    .catch(function(error) {
        console.log(error);
        res.render('index',{api_key: apiKey, api_secret: apiSecret, client_guid: clientGUID, authCredentialsRes: "AUTHENTICATION FAILED!", outlet_name: outletName, createTSSRes: "", disableTSSRes: "", retrieveTSSRes: "", status_code: 500, tssList: [], admin_pin: '', tssInfo: ''});
    });

});

router.post('/createClient', async (req, res, next) => {

    const clientGUID = req.body.clientGuid;
    const tssID = req.body.tssId;
	const registerName = req.body.registerName;
    const registerID = req.body.registerId;
    const outletName = req.body.outlet;
	const serialNum = req.body.serialNum;

    let getCredentials;
    try {
        getCredentials = await makeDBRequest(
            "SELECT * FROM fiskalycredentials WHERE client_guid=$1;", 
            [clientGUID]
        )
    } catch(e) {
        return res.send({status: 500, msg: "Auth failed - Fail to get credentials.", error: e.detail});
    }

    if (getCredentials.rowCount === 0) {
        return res.send({status: 500, msg: "Auth failed - Fail to get credentials."});
    }
    const apiKey = getCredentials.rows[0].api_key;
    const apiSecret = getCredentials.rows[0].api_secret;

    let getTSSDetails;
    try {
        getTSSDetails = await makeDBRequest(
            "SELECT * FROM fiskalytssdetails WHERE client_guid=$1 AND tss_id=$2;", 
            [clientGUID, tssID]
        )
    } catch(e) {
        return res.send({status: 500, msg: "Fail to get tss details.", error: e.detail});
    }

    if (getTSSDetails.rowCount === 0) {
        return res.send({status: 500, msg: "Fail to get tss details, no tss found."});
    }

    const adminPin = getTSSDetails.rows[0].admin_pin;
    
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
        
       // console.log(response.data);
        const accessToken = response.data.access_token;

        let bearerAuth = `Bearer ${accessToken}`; 
        
        let authAdminConfig = {
            method: 'post',
            url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}/admin/auth`,
            headers: { 
                'Authorization': bearerAuth, 
                'Content-Type': 'application/json'
            },
            data : JSON.stringify({
                "admin_pin": adminPin
            })
        };

        //AUTH ADMIN SIGN IN CALL
        axios(authAdminConfig)
            .then((response) => {

                const clientID = uuidv4();
                
                let createClientConfig = {
                    method: 'put',
                    url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}/client/${clientID}`,
                    headers: { 
                        'Authorization': bearerAuth, 
                        'Content-Type': 'application/json'
                    },
                    data : JSON.stringify({
                        "serial_number": serialNum,
                        "metadata":{
                            "register_name": registerName,
                            "register_id": registerID,
                            "client_guid": clientGUID,
                            "outlet_name": outletName
                        }
                    })
                };

                // CREATE CLIENT CALL
                axios(createClientConfig)
                .then(async (response) => {
                    console.log("CREATE CLIENT RESPONSE: ", response.data);
                    if (response.data.state == "REGISTERED"){

                        let insertClient;
                        try {
                            insertClient = await makeDBRequest(
                                "INSERT INTO fiskalyclients VALUES($1, $2, $3, $4);", 
                                [clientGUID, registerID, response.data._id, response.data.serial_number]
                            )
                        } catch(e) {
                            return res.status(500).send({status: 500, msg: "Auth failed - Fail to get credentials."});
                        }

                        console.log("insertClient.rowCount: ", insertClient.rowCount);
                        
                        return res.status(200).send({status_code: 200});

                    }else{
                        return res.status(500).send({status_code: 500, msg: "Client created but failed to record in the db."});
                    }
                })
                // CREATE CLIENT FAILURE
                .catch(function (error) {
                    console.log("Failed to create client: ", error);
                    return res.status(500).send({status_code: 500, msg: "Failed to create client."});
                });
                  
    
            })
            // AUTH ADMIN FAILURE
            .catch(function (error) {
                console.log("Auth admin failed: ", error);
                return res.status(500).send({status_code: 500, msg: "Auth Admin failed."});   
            });




    }).catch((error) => {
        console.log("AUTH CALL FAILED: ", error);
        return res.send({status: 500, msg: "Auth failed."});
    });
    
})




router.post('/deregister', async (req, res, next) => {

    const clientGUID = req.body.clientGuid;
    const clientID = req.body.clientId;
    const serialNum = req.body.serialNum;
    const tssID = req.body.tssId;
    const outlet = req.body.outlet;


    let getCredentials;
    try {
        getCredentials = await makeDBRequest(
            "SELECT * FROM fiskalycredentials WHERE client_guid=$1;", 
            [clientGUID]
        )
    } catch(e) {
        return res.send({status: 500, msg: "Auth failed - Fail to get credentials.", error: e.detail});
    }

    if (getCredentials.rowCount === 0) {
        return res.send({status: 500, msg: "Auth failed - Fail to get credentials."});
    }
    const apiKey = getCredentials.rows[0].api_key;
    const apiSecret = getCredentials.rows[0].api_secret;

    let getTSSDetails;
    try {
        getTSSDetails = await makeDBRequest(
            "SELECT * FROM fiskalytssdetails WHERE client_guid=$1 AND tss_id=$2 AND outlet=$3;", 
            [clientGUID, tssID, outlet]
        )
    } catch(e) {
        return res.send({status: 500, msg: "Auth failed - Fail to get admin pin.", error: e.detail});
    }

    if (getTSSDetails.rowCount === 0) {
        return res.send({status: 500, msg: "Auth failed - Fail to get admin pin."});
    }

    const adminPin = getTSSDetails.rows[0].admin_pin


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

        const accessToken = response.data.access_token;

        let authAdminData = JSON.stringify({
            "admin_pin": adminPin
        });
        
        let authAdminConfig = {
            method: 'post',
            url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}/admin/auth`,
            headers: { 
                'Authorization': `Bearer ${accessToken}`, 
                'Content-Type': 'application/json'
            },
            data : authAdminData
        };
        
        axios(authAdminConfig)
        .then(function (response) {
            console.log("AUTH ADMIN RESPONSE: ", response.data);


            let deregisterClientData = JSON.stringify({
                "state": "DEREGISTERED"
            });
              
            let deregisterClientConfig = {
                method: 'patch',
                url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}/client/${clientID}`,
                headers: { 
                    'Authorization': `Bearer ${accessToken}`, 
                    'Content-Type': 'application/json'
                },
                data : deregisterClientData
            };
            
            axios(deregisterClientConfig)
            .then(function (response) {
                console.log("DEREGISTER CLIENT RESPONSE: ", response.data);

                let listClientsConfig = {
                    method: 'get',
                    url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}/client`,
                    headers: { 
                        'Authorization': `Bearer ${accessToken}`
                    }
                };
                
                axios(listClientsConfig)
                .then(async (response) => {
                    console.log("LIST CLIENTS OF TSS RESPONSE: ", response.data);
                    let dataList = response.data.data;
                    let clientList = [];
                    for (let i = 0; i < dataList.length; i++){
                        if (dataList[i].state == "REGISTERED"){
                            clientList.push(dataList[i]);
                        }
                    }

                    let deleteClient;
                    try {
                        deleteClient = await makeDBRequest(
                            "DELETE FROM fiskalyClients WHERE client_guid=$1 AND client_id=$2 AND client_serial=$3;", 
                            [clientGUID, clientID, serialNum]
                        )
                    } catch(e) {
                        return res.send({status: 500, msg: "Failed to delete client from db", error: e.detail});
                    }

                    if (deleteClient.rowCount === 0) {
                        return res.send({status: 500, msg: "Client not removed from db."});
                    }

                    return res.send({status_code: 200, msg: "Client deregistered."});


                    
                })
                .catch(function (error) {
                    console.log("ERROR RESPONSE FROM LIST CLIENT: ", error);
                    
                    return res.send({status_code: 500, msg: "Failed to retrieve client lists using TSS."});
                });

            })
            .catch(function (error) {
                console.log("ERROR RESPONSE FROM DEREGISTER CLIENT: ", error);
                let errorMsg = error.response.data.message;
                let listClientsConfig = {
                    method: 'get',
                    url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}/client`,
                    headers: { 
                        'Authorization': `Bearer ${accessToken}`
                    }
                };
                
                axios(listClientsConfig)
                .then(function (response) {
                    console.log("LIST CLIENTS OF TSS RESPONSE: ", response.data);
                    let dataList = response.data.data;
                    let clientList = [];
                    for (let i = 0; i < dataList.length; i++){
                        if (dataList[i].state == "REGISTERED"){
                            clientList.push(dataList[i]);
                        }
                    }
                    return res.send({status_code: 500, msg: "Failed to deregister client."});
                })
                .catch(function (error) {
                    console.log("ERROR RESPONSE FROM LIST CLIENT: ", error);
                    
                    return res.send({status_code: 500, msg: "Failed to deregister client and list clients."});
                });
            });
        })
        // AUTH ADMIN FAILURE
        .catch(function (error) {
            console.log("ERROR RESPONSE FROM AUTH ADMIN: ", error);
            let listClientsConfig = {
                method: 'get',
                url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}/client`,
                headers: { 
                    'Authorization': `Bearer ${accessToken}`
                }
            };
            
            axios(listClientsConfig)
            .then(function (response) {
                console.log("LIST CLIENTS OF TSS RESPONSE: ", response.data);
                let dataList = response.data.data;
                let clientList = [];
                for (let i = 0; i < dataList.length; i++){
                    if (dataList[i].state == "REGISTERED"){
                        clientList.push(dataList[i]);
                    }
                }
                return res.send({status_code: 500, msg: "Failed to auth admin."});
            })
            .catch(function (error) {
                console.log(error);
                return res.send({status_code: 500, msg: "Failed to auth admin and list clients."});
            });
        });

    })
    // CREDENTIALS AUTH FAILURE
    .catch(function (error) {
        console.log("AUTH ERROR: ", error);
        return res.send({status_code: 500, msg: "Auth failed with given API credentials."});
    });
});

router.get('/clients', async(req,res,next) => {
    const clientGUID = req.query.clientGuid;
    const tssID = req.query.tssId;
    const outlet = req.query.outlet;

    let getCredentials;
    try {
        getCredentials = await makeDBRequest(
            "SELECT * FROM fiskalycredentials WHERE client_guid=$1;", 
            [clientGUID]
        )
    } catch(e) {
        return res.status(500).render('clients', {status: 500, msg: "Auth failed - Fail to get credentials."});
    }

    if (getCredentials.rowCount === 0) {
        return res.status(500).render('clients', {status: 500, msg: "Auth failed - Fail to get credentials."});
    }
    const apiKey = getCredentials.rows[0].api_key;
    const apiSecret = getCredentials.rows[0].api_secret;
    
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
    //AUTH CALL
    axios(authConfig)
    .then((response) => {
        const bearerAuth = response.data.access_token;
        
        let listClientsConfig = {
            method: 'get',
            url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}/client`,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization' : `Bearer ${bearerAuth}`
            },
        };
        // LIST CLIENTS OF A TSS API CALL
        axios(listClientsConfig)
        .then(async (response) => {
            const clientsList = response.data.data;
            console.log("clientsList: ", clientsList);
            return res.status(200).render('clients', {status_code: 200, clients_list: clientsList, outlet: outlet});


        }).catch((error) => {
            console.log("LIST CLIENT OF A TSS FAILED: ", error);
            return res.status(500).render('clients', {status_code: 500, msg: "Failed to retrieve TSS list."});
        });

    })
    .catch((error) => {
        console.log(error);
        return res.status(500).render('clients', {status_code: 500, msg: "Auth failed."});
    });


    
})

router.post('/transactions' , async (req,res,next) => {
    const clientGUID = req.body.clientGuid;
    const tssID = req.body.tssId;
    
    let getCredentials;
    try {
        getCredentials = await makeDBRequest(
            "SELECT * FROM fiskalycredentials WHERE client_guid=$1;", 
            [clientGUID]
        )
    } catch(e) {
        return res.status(500).render('clients', {status: 500, msg: "Auth failed - Fail to get credentials."});
    }

    if (getCredentials.rowCount === 0) {
        return res.status(500).render('clients', {status: 500, msg: "Auth failed - Fail to get credentials."});
    }
    const apiKey = getCredentials.rows[0].api_key;
    const apiSecret = getCredentials.rows[0].api_secret;
    
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
    //AUTH CALL
    axios(authConfig)
    .then((response) => {
        const bearerAuth = response.data.access_token;

        let listTransConfig = {
            method: 'get',
            url: `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tssID}/tx`,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${bearerAuth}`
            }
        };

        axios(listTransConfig)
        .then((response) => {
            return res.status(200).send({status_code: 200, trans_list: response.data.data});

        }).catch((error) => {
            console.log("List transactions by TSS failed: ", error);
            return res.status(500).send({status_code: 500, msg: "Failed to fetch transactions"});
        })


    }).catch((error) => {
        console.log("AUTH FAILED: ", error);
        return res.send({status_code: 500, msg: "Auth failed."});
    })
});
  
  
router.post('/dataExports', (req, res,next) =>{
    var data = JSON.stringify({
        "api_key": "test_4ffvrpykwaae6wkrgvudaibg5_oliverpos",
        "api_secret": "8iWF2PxSRoxBbYkvn40GtRTEE8WIwDHpjpR4xY16SpJ"
    });

    var config = {
        method: 'post',
        url: 'https://kassensichv-middleware.fiskaly.com/api/v2/auth',
        headers: { 
        'Content-Type': 'application/json'
        },
        data : data
    };

    axios(config)
    .then(function (response) {
        var atn = response.data.access_token;
        //res.send(atn);
        //Url to retrieve all clients
        var url4 = `https://kassensichv-middleware.fiskaly.com/api/v2/export`;
        var config1 = {
        method: 'get',
        url: url4,
        headers: { 
            'Content-Type': 'application/json',
            'Authorization' : `Bearer ${atn}`
            },
        data: {}
        };
        axios(config1)
        .then(function (response) {
        var exportList = response.data.data;
        //console.log(exportList);
        // res.send(exportList);
        res.render('exports', {exports : exportList});


        //res.render('client', {client : response.data, });
        })
        .catch(function (error) {
        console.log(error);
        });   
        //console.log(JSON.stringify(response.data));
    })
    .catch(function (error) {
        console.log(error);
    });

});



router.post('/triggerExport' , (req, res, next) => {
    //create the unique identifier for the export
    var uid =uuidv4();
    console.log(uid);
    //res.send(uid);
    var data = JSON.stringify({
        "api_key": "test_4ffvrpykwaae6wkrgvudaibg5_oliverpos",
        "api_secret": "8iWF2PxSRoxBbYkvn40GtRTEE8WIwDHpjpR4xY16SpJ"
        });
        
        var config = {
        method: 'post',
        url: 'https://kassensichv-middleware.fiskaly.com/api/v2/auth',
        headers: { 
            'Content-Type': 'application/json'
        },
        data : data
        };
        
        axios(config)
        .then(function (response) {
        var atn = response.data.access_token;
        //res.send(atn);
        //Url to retrieve all clients
        var tss_id = "0458b31d-66d6-46a7-8572-2d5dde97dbb6";
        var export_id = uid;
        var url4 = `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tss_id}/export/${export_id}`;
        var config1 = {
            method: 'put',
            url: url4,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization' : `Bearer ${atn}`
            },
            data: {}
            };
        axios(config1)
        .then(function (response) {
            console.log(response);
            res.redirect(307, '/setup/dataExports');
        
        
            //res.render('client', {client : response.data, });
        })
        .catch(function (error) {
            console.log(error);
        });   
        //console.log(JSON.stringify(response.data));
        })
        .catch(function (error) {
        console.log(error);
        });
});

router.post('/thisexport',(req, res, next) => {
    console.log(req.body);
    var tss_id = req.body.tss_id;
    var export_id = req.body.export_id;
    var url = `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tss_id}/export/${export_id}`;
    var data = JSON.stringify({
        "api_key": "test_4ffvrpykwaae6wkrgvudaibg5_oliverpos",
        "api_secret": "8iWF2PxSRoxBbYkvn40GtRTEE8WIwDHpjpR4xY16SpJ"
    });
    var atn;
    var config = {
        method: 'post',
        url: 'https://kassensichv-middleware.fiskaly.com/api/v2/auth',
        headers: { 
        'Content-Type': 'application/json'
        },
        data : data
    };
    var data1 = JSON.stringify({});
    
    axios(config)
    .then(function (response) {
        atn = response.data.access_token;
        var config1 = {
            method: 'get',
            url: url,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization' : `Bearer ${atn}`
                },
            data: {}   
        };
    
        axios(config1)
        .then((response) => {
            var thisExport = response.data;
            console.log(thisExport);
            //res.render('thisexport', {thisexport: thisExport});
            var url4 = `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tss_id}/export/${export_id}/metadata`;
            var config3 = {
            method: 'get',
            url: url4,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization' : `Bearer ${atn}`
                },
            data: {}
            };
            axios(config3)
            .then(function (response) {
                console.log(response.data);
                let list1 = Object.entries(response.data);
                res.render('thisexport', {thisexport: thisExport, metadata: list1});
        
        
            //res.render('client', {client : response.data, });
            })
            .catch(function (error) {
                console.log(error);
            });   
            
        })
        .catch(function (error) {
            console.log(error);
        });
    
    })
    .catch(function (error) {
        console.log(error);
    });
    
    console.log(tss_id);
    console.log(export_id);
    //res.send("yolo bitches");
});
router.post('/getTar', (req, res, next) => {
    var tss_id = req.body.tss_id;
    var export_id = req.body.export_id;
    var url = `https://kassensichv-middleware.fiskaly.com/api/v2/tss/${tss_id}/export/${export_id}/file`;


    var axios = require('axios');
    var data = JSON.stringify({
        "api_key": "test_4ffvrpykwaae6wkrgvudaibg5_oliverpos",
        "api_secret": "8iWF2PxSRoxBbYkvn40GtRTEE8WIwDHpjpR4xY16SpJ"
    });
    var atn;
    var config = {
        method: 'post',
        url: 'https://kassensichv-middleware.fiskaly.com/api/v2/auth',
        headers: { 
        'Content-Type': 'application/json'
        },
        data : data
    };
    var data1 = JSON.stringify({});

    axios(config)
    .then(function (response) {
        atn = response.data.access_token;
        var config1 = {
            method: 'get',
            url: url,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization' : `Bearer ${atn}`
            },
            data: {}   
        };

        axios(config1)
        .then((response) => {
            var csv = response.data; // Not including for example.
            //console.log(csv);
        res.setHeader('Content-disposition', 'attachment; filename=testtarfile.csv');
        res.set('Content-Type', 'application/json');
        res.status(200).send(csv);
        })
        .catch(function (error) {
            console.log(error);
        });

    })
    .catch(function (error) {
        console.log(error);
    });

});






module.exports = router;
