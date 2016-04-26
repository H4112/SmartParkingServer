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