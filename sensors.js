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
        	collection.deleteMany( {}, function(err, results) {
			    populateDB();
			});
        	/*
            if (err) {
                console.log("The 'sensors' collection doesn't exist. Creating it with sample data...");
                populateDB();
            }
            */
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
			collection.findOne({'id':parseInt(id)}, function(err, item) { 
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
		collection.findOne({'id':parseInt(id)}, function(err, sensor) {
			console.log("etat actuel :" + sensor.etat);
			if(etat != sensor.etat){
					collection.updateOne({'id':parseInt(id)}, {$set: {'etat':etat, 'derniereMaj': Date.now(), 'dernierSigneDeVie':Date.now()}}, {safe:true}, function(err, result) {
						if (err) {
							console.log('Error updating sensor: ' + err);
							res.status(500).end();
						} else {
							console.log('Updating sensor status, now:' + etat)
							res.status(200).end();
						}
					});
			}else{
				db.collection('sensors', function(err, collection) {
					console.log("no update");
					collection.updateOne({'id':parseInt(id)}, {$set: {'dernierSigneDeVie': Date.now()}}, {safe:true}, function(err, result) {
							res.status(200).end();
					});
				});
			}
		});
	});

};

exports.getCapteursAProximite = function(req, res) {
	var rayon = req.body.rayon;
	var longitude = req.body.longitude;
	var latitude = req.body.latitude;
	
    db.collection('sensors', function(err, collection) {
        collection.find().toArray(function(err, items) {
			var capteurs = items.map(function(sensor){
				var d = getDistanceFromLatLonInM(latitude, longitude, sensor.latitude, sensor.latitude);
				if(d<= rayon){
					return sensor;
				}else return null;
			});
            res.status(200).send(capteurs);
        });
    });
};

function getDistanceFromLatLonInM(lat1,lon1,lat2,lon2) {
  var R = 6371008.8; // Radius of the earth in m
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in m
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}


// ----------------------------------------
// ----------------------------------------

var populateDB = function() {
	var coordinates = [
		[ 45.7822840, 4.871439000 ],
		[ 45.7816303, 4.872742742 ],
		[ 45.7816752, 4.872726649 ],
		[ 45.7817189, 4.872706532 ],
		[ 45.7817652, 4.872685074 ],
		[ 45.7818075, 4.872666299 ],
		[ 45.7818538, 4.872650206 ],
		[ 45.7818948, 4.872631430 ],
		[ 45.7819398, 4.872609972 ],
		[ 45.7815945, 4.872608631 ],
		[ 45.7816422, 4.872589856 ],
		[ 45.7816832, 4.872569739 ],
		[ 45.7817361, 4.872550964 ],
		[ 45.7817824, 4.872529506 ],
		[ 45.7818260, 4.872509390 ],
		[ 45.7818750, 4.872483909 ],
		[ 45.7819186, 4.872467815 ],
		[ 45.7814760, 4.872952000 ],
		[ 45.7814825, 4.872983125 ],
		[ 45.7814890, 4.873014250 ],
		[ 45.7814955, 4.873045375 ],
		[ 45.7815020, 4.873076500 ],
		[ 45.7815085, 4.873107625 ],
		[ 45.7815150, 4.873138750 ],
		[ 45.7815215, 4.873169875 ],
		[ 45.7815280, 4.873201000 ]
	];
	var id = 0;
    var sensors = coordinates.map(function(c) {
    	id++;
    	return {
	    	id: id,
	        etat: "libre",
	        latitude: c[0],
			longitude: c[1],
	        idRue: id,
	        derniereMaj: Date.now(),
			dernierSigneDeVie: Date.now()
    	}
    });
    /*
    [
    {
        id: 1,
        etat: "libre",
        latitude: 45.781459,
		longitude: 4.872962,
        idRue: 1,
        derniereMaj: 1461742140,
		dernierSigneDeVie: 1461742140
    },
    {
        id: 2,
        etat: "depart",
        latitude: 45.782284,
		longitude: 4.871439,
        idRue: 2,
        derniereMaj: 1461742110,
		dernierSigneDeVie: 1461742140
    }

    ];
	*/
    db.collection('sensors', function(err, collection) {
        collection.insert(sensors, {safe:true}, function(err, result) {});
    });

};