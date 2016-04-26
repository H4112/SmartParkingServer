var express = require('express');
var sensors = require('./sensors');

var app = express();

app.get('/sensors', sensors.getListeCapteurs);

app.get('/sensors/:id', sensors.getInfosCapteur);

// ... Tout le code de gestion des routes (app.get) se trouve au-dessus
app.use(function(req, res, next){
    res.setHeader('Content-Type', 'text/plain');
    res.send(404, 'Page introuvable !');
});

app.listen(8080);