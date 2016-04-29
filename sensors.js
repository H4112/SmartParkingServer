var mongo = require('mongodb');
var https = require('https');
var async = require('async');

var Server = mongo.Server;
var Db = mongo.Db;
var BSON = mongo.BSONPure;

var server = new Server('localhost', 27017, { auto_reconnect: true });
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
        setInterval(function() {
        	updateParkings();
		}, 15*60*1000); // every 15 min
        updateParkings(); // first time now
    } else {
		console.log(err);
	}
});

exports.getListeCapteurs = function(req, res) {
	async.parallel({
		capteurs: function(callback) {
			db.collection('sensors', function(err, collection) {
				collection.find().toArray(function(err, items) {
		        	var capteurs = items;
		        	if(req.query.latitude && req.query.longitude && req.query.radius) {
		        		var rayon = req.query.radius;
						var longitude = req.query.longitude;
						var latitude = req.query.latitude;
						//console.log("lat="+latitude+"&lon="+longitude+"&r="+rayon);
			        	capteurs = capteurs.filter(function(sensor) {
							var d = getDistanceFromLatLonInM(latitude, longitude, sensor.latitude, sensor.longitude);
							return d <= rayon;
						});
		        	}
		            callback(null, capteurs);
		        });
		    });
		},
		parkings: function(callback) {
			db.collection('parkings', function(err, collection) {
				collection.find().toArray(function(err, items) {
		        	var parkings = items;
		        	if(req.query.latitude && req.query.longitude && req.query.radius) {
		        		var rayon = req.query.radius;
						var longitude = req.query.longitude;
						var latitude = req.query.latitude;
						//console.log("lat="+latitude+"&lon="+longitude+"&r="+rayon);
			        	parkings = parkings.filter(function(parking) {
							var d = getDistanceFromLatLonInM(latitude, longitude, parking.latitude, parking.longitude);
							return d <= rayon;
						});
		        	}
		            callback(null, parkings);
		        });
		    });
		}
	}, function(err, results) {
		if(!err) {
			res.status(200).send(results);
		} else {
			console.log(err);
			res.status(500).end();
		}
	});
};

exports.getInfosCapteur = function(req, res) {
	var id = req.params.id;
	console.log('Retrieving sensor: ' + id);
    db.collection('sensors', function(err, collection) {
		if(err) {
			console.log(err);
			res.status(500).end();
		} else {
			collection.findOne({ '_id': parseInt(id) }, function(err, item) { 
				res.status(200).send(item); 
        	}); 
		}
    });
};

exports.setInfoCapteur = function(req, res) {
    var id = req.params.id;
	var codeEtat = req.body.etat;
	var etat;
	
	console.log('sensor status code:' + codeEtat)

	if(codeEtat == 0) {
		etat = 'libre';
	} else if(codeEtat == 1) {
		etat = 'depart';
	} else if(codeEtat == 2) {
		etat = 'occupe';
	}

	console.log('Pushing update for sensor: ' + id); 	
	
	db.collection('sensors', function(err, collection) {
		collection.findOne({'_id':parseInt(id)}, function(err, sensor) {
			console.log("etat actuel :" + sensor.etat);
			if(etat != sensor.etat) {
				collection.updateOne(
					{
						'_id': parseInt(id)
					},
					{
						$set:
							{
								'etat':etat,
								'derniereMaj': Date.now(),
								'dernierSigneDeVie':Date.now()
							}
					},
					{
						safe:true
					},
					function(err, result) {
						if (err) {
							console.log('Error updating sensor: ' + err);
							res.status(500).end();
						} else {
							console.log('Updating sensor status, now:' + etat)
							res.status(200).end();
						}
					}
				);
			} else {
				db.collection('sensors', function(err, collection) {
					console.log("no update");
					collection.updateOne({'_id':parseInt(id)}, {$set: {'dernierSigneDeVie': Date.now()}}, {safe:true}, function(err, result) {
							res.status(200).end();
					});
				});
			}
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

function updateParkings() {
	https.get({
		hostname: 'download.data.grandlyon.com',
		path: '/wfs/rdata?SERVICE=WFS&VERSION=2.0.0&outputformat=GEOJSON&request=GetFeature&typename=pvo_patrimoine_voirie.pvoparkingtr&SRSNAME=urn:ogc:def:crs:EPSG::4258',
		auth: 'rsauget@me.com:Ih(mjBRnl#7@,PDdoP=M'
	}, function(res) {
		var body = '';
		res.on('data', function(d) {
			body += d;
		});
		res.on('end', function() {
			try {
				var parkings = JSON.parse(body);
				parkings = parkings.features.map(function(f) {
					var parking = f.properties;
					parking.longitude = f.geometry.coordinates[0];
					parking.latitude = f.geometry.coordinates[1];
					parking._id = parking.pkgid;
					delete parking.pkgid;
					return parking;
				});
				//console.log(parkings);
				db.collection('parkings', function(err, collection) {
	        		parkings.forEach(function(parking) {
	        			collection.save(parking);
	        		});
	        		console.log('Parkings updated');
				});
			} catch(e) {
				console.log('Error when updating parking data : ' + e);
			}
		});
	});
}

function populateDB() {
	var coordinates = [
		[
			[ 45.7822840, 4.87143900 ]
		],
		[
			[ 45.7816303, 4.87274274 ],
			[ 45.7816752, 4.87272664 ],
			[ 45.7817189, 4.87270653 ],
			[ 45.7817652, 4.87268507 ],
			[ 45.7818075, 4.87266629 ],
			[ 45.7818538, 4.87265020 ],
			[ 45.7818948, 4.87263143 ],
			[ 45.7819398, 4.87260997 ],
			[ 45.7815945, 4.87260863 ],
			[ 45.7816422, 4.87258985 ],
			[ 45.7816832, 4.87256973 ],
			[ 45.7817361, 4.87255096 ],
			[ 45.7817824, 4.87252950 ],
			[ 45.7818260, 4.87250939 ],
			[ 45.7818750, 4.87248390 ],
			[ 45.7819186, 4.87246781 ]
		],
		[
			[ 45.7814760, 4.87295200 ],
			[ 45.7814825, 4.87298312 ],
			[ 45.7814890, 4.87301425 ],
			[ 45.7814955, 4.87304537 ],
			[ 45.7815020, 4.87307650 ],
			[ 45.7815085, 4.87310762 ],
			[ 45.7815150, 4.87313875 ],
			[ 45.7815215, 4.87316987 ],
			[ 45.7815280, 4.87320100 ]
		],
		[
			[ 45.7817620, 4.87172100 ],
			[ 45.7817689, 4.87175257 ],
			[ 45.7817759, 4.87178414 ],
			[ 45.7817828, 4.87181571 ],
			[ 45.7817897, 4.87184729 ],
			[ 45.7817966, 4.87187886 ],
			[ 45.7818036, 4.87191043 ],
			[ 45.7818105, 4.87194200 ],
			[ 45.7818174, 4.87197357 ],
			[ 45.7818244, 4.87200514 ],
			[ 45.7818313, 4.87203671 ],
			[ 45.7818382, 4.87206829 ],
			[ 45.7818451, 4.87209986 ],
			[ 45.7818521, 4.87213143 ],
			[ 45.7818590, 4.87216300 ],
			[ 45.7818659, 4.87219457 ]
		]
	];
	var id = 0;
	var sensors = [];
	for(var i=0;i<coordinates.length;i++) {
		sensors = sensors.concat(coordinates[i].map(function(c) {
	    	id++;
	    	return {
		    	_id: id,
		        etat: "libre",
		        latitude: c[0],
				longitude: c[1],
		        idRue: i,
		        derniereMaj: Date.now(),
				dernierSigneDeVie: Date.now(),
				adresse: 'Adresse inconnue'
	    	}
	    }));
	}
    
    db.collection('sensors', function(err, collection) {
    	if(!err) {
	        collection.insert(sensors, {safe:true}, function(err, result) {
	        	// Lookup address
	        	var i = 0;
	        	var interval = setInterval(function() {
	        		if(i == sensors.length) {
	        			clearInterval(interval);
	        			return;
	        		}
	        		var sensor = sensors[i];
	        		i++;
	        		// Reverse geocoding
		        	https.get('https://maps.googleapis.com/maps/api/geocode/json?latlng='+sensor.latitude+','+sensor.longitude+'&sensor=true', function(res) {
		        		var body = '';
		        		res.on('data', function(d) {
		        			body += d;
						});
						res.on('end', function() {
							var adresse = 'Adresse inconnue';
							try {
		        				var data = JSON.parse(body);
								adresse = data.results[0].formatted_address;
							} catch(e) {
								console.log('JSON error : '+e);
								console.log(body);
							}
							collection.updateOne({'_id':sensor._id}, {$set: {'adresse': adresse}}, {safe:true}, function(err, result) {});
						});
		    		});
	        	}, 500);

	        	// Simulation
				setInterval(function() {
					var id = Math.floor((Math.random() * (sensors.length - 1)) + 2);
					var codeEtat = Math.floor(Math.random() * 3);
					var etat;
					if(codeEtat == 0) {
						etat = 'libre';
					} else if(codeEtat == 1) {
						etat = 'depart';
					} else if(codeEtat == 2) {
						etat = 'occupe';
					}
					collection.updateOne({'_id':id}, {$set: {'etat':etat, 'derniereMaj': Date.now(), 'dernierSigneDeVie':Date.now()}}, {safe:true}, function(err, result) {
						if (err) {
							console.log('Error fake-updating sensor ' + id + ': ' + err);
						} else {
							console.log('Fake-updating sensor ' + id + ' status, now: ' + etat);
						}
					});
				}, 1000);
	        });
	    } else {
	    	console.log(err);
	    }
    });
};
