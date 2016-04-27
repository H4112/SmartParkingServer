#!/usr/bin/env node
var express = require('express');
var sensors = require('./sensors');
var https = require('https');
var fs = require('fs');

var options = {
  ca: [fs.readFileSync('/etc/letsencrypt/live/parking.rsauget.fr/chain.pem')],
  cert: fs.readFileSync('/etc/letsencrypt/live/parking.rsauget.fr/cert.pem'),
  key: fs.readFileSync('/etc/letsencrypt/live/parking.rsauget.fr/privkey.pem')
};

var app = express();

app.get('/sensors', sensors.getListeCapteurs);

app.get('/sensors/:id', sensors.getInfosCapteur);

app.put('/sensors/:id', sensors.setInfoCapteur);

// ... Tout le code de gestion des routes (app.get) se trouve au-dessus
app.use(function(req, res, next){
    res.setHeader('Content-Type', 'text/plain');
    res.status(404).send('Page introuvable !');
});

var server = https.createServer(options, app);

server.listen(8080, function(){
    console.log("server running at https://parking.rsauget.fr:8080/")
});
