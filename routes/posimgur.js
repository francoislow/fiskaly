var express = require('express');
var router = express.Router();
var axios = require('axios');


router.post('/upload', function(req, res, next) {

    let rawQR = req.body.qr_code;
    let uploadData = JSON.stringify({
        "qr_code": rawQR
    });
      
    let uploadConfig = {
        method: 'post',
        url: 'https://manage-test.oliverpos.app/images/upload',
        headers: { 
          'Content-Type': 'application/json'
        },
        data : uploadData
    };
      
    axios(uploadConfig)
    .then(function (response) {
        console.log(response.data);
        res.send({"url": response.data.url, "img_id": response.data.img_id, "status": 200});
    })
    .catch(function (error) {
        console.log(error);
    });


});

router.post('/delete', function(req, res, next) {

    let imgID = req.body.img_id;
    let deleteData = JSON.stringify({
        "img_id": imgID
    });
      
    let deleteConfig = {
        method: 'delete',
        url: 'https://manage-test.oliverpos.app/images/delete',
        headers: { 
          'Content-Type': 'application/json'
        },
        data : deleteData
    };
      
    axios(deleteConfig)
    .then(function (response) {
        console.log("Delete imageAPI response: ", response.data);
        res.send({"status": response.data.status, "outcome": response.data.outcome});
    })
    .catch(function (error) {
        console.log(error);
    });

});

module.exports = router;
