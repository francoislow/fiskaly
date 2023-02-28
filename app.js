const express = require('express');
const path = require('path');
const app = express();

const manage = require('./routes/manage');
const setup = require('./routes/setup');
const posIndex = require('./routes/posIndex');
const transactions = require('./routes/transactions');
const imgur = require('./routes/posimgur');
require("dotenv").config();


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');



app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/manage/', manage);
app.use('/manage/setup', setup);
app.use('/pos', posIndex);
app.use('/pos/transactions', transactions);
app.use('/pos/imgur', imgur);


const port = process.env.APP_PORT || 3000;
app.listen(port, () => {
    console.log("Server started on port " + port);
});