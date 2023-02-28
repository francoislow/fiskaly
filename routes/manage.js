const express = require('express');
const router = express.Router();
const makeDBRequest = require("../db");

let clientGUID, apiKey, apiSecret;



router.get('/', function(req, res, next) {
    res.render('loading');
});

router.get('/signup', function(req, res, next) {
    res.render('signup');
});

router.post('/loading', function(req, res, next) {
    clientGUID = req.body.client_guid;
    let queryCredentials = `SELECT api_key, api_secret FROM fiskalyCredentials WHERE client_guid='${clientGUID}';`;
    // ADD DB QUERY TO FIND CLIENT GUID
    
    makeDBRequest(queryCredentials)
    .then(dbResponse => {
        if (dbResponse.rowCount != 0){
            apiKey = dbResponse.rows[0].api_key;
            apiSecret = dbResponse.rows[0].api_secret;
            res.send({"statusCode": 200});

        }else{
            res.send({"statusCode": 500});
        }
    })
    .catch(err => {
        console.log(err);
        
    })
});

router.get('/dashboard', function(req, res, next) {
    
    console.log("API KEY: ", apiKey);
    console.log("API SECRET: ", apiSecret);
    console.log("/login CLIENT GUID: ", clientGUID);

    res.render('index');

});





module.exports = router;
