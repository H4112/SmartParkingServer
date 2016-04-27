var mongo = require('mongodb');

var Server = mongo.Server;
var Db = mongo.Db;
var BSON = mongo.BSONPure;

var server = new Server('localhost', 27017, {auto_reconnect: true});
db = new Db('smartparking', server);

db.open(function(err, db) {
    if(!err) {
        console.log("Connected to 'smartparking' database");
        db.collection('sensors', {strict:true}, function(err, collection) {
            if (err) {
                console.log("The 'sensors' collection doesn't exist. Creating it with sample data...");
                populateDB();
            }
        });
    } else {
		
		console.log(err);
	}
});

exports.getListeCapteurs = function(req, res) {
    db.collection('sensors', function(err, collection) {
        collection.find().toArray(function(err, items) {
            res.send(items);
        });
    });
};

exports.getInfosCapteur = function(req, res) {
	var id = req.params.id;
	console.log('Retrieving sensor: ' + id);
    db.collection('sensors', function(err, collection) {
		if(err){
			console.log(err);
			res.end();
		}else{
			collection.findOne({'id':id}, function(err, item) { 
			res.send(item); 
        }); 
		}
    });
};

exports.setInfoCapteur = function(req, res) {
    var id = req.params.id;
	var codeEtat = req.body.etat;
	var etat;
	
	console.log('sensor status code:' + codeEtat)

	
	if(codeEtat == 0){
		etat = 'libre';
	}else if(codeEtat == 1){
		etat = 'depart';
	}else if(codeEtat == 2){
		etat = 'occupe';
	}

	console.log('Pushing update for sensor: ' + id); 	
	
	db.collection('sensors', function(err, collection) {
	collection.updateOne({'id':id}, {$set: {'etat':etat}}, {safe:true}, function(err, result) {
            if (err) {
                console.log('Error updating sensor: ' + err);
                res.send({'error':'An error has occurred'});
            } else {
				console.log('Updating sensor status, now:' + etat)
                res.send(etat);
            }
        });
    });
};


// ----------------------------------------
// ----------------------------------------

var populateDB = function() {

    var sensors = [
    {
        id: "1",
        etat: "libre",
        latitude: "45.781459",
		longitude: "4.872962",
        idRue: "1",
        dureeEtatActuel: "10"
    },
    {
        id: "2",
        etat: "depart",
        latitude: "45.782284",
		longitude: "4.871439",
        idRue: "2",
        dureeEtatActuel: "1"
    }];

    db.collection('sensors', function(err, collection) {
        collection.insert(sensors, {safe:true}, function(err, result) {});
    });

};