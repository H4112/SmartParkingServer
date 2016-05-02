'use strict';

var mongo = require('mongodb');
var https = require('https');
var async = require('async');

var Server = mongo.Server;
var Db = mongo.Db;
var BSON = mongo.BSONPure;

var server = new Server('localhost', 27017, { auto_reconnect: true });
var db = new Db('smartparking', server);

db.open(function(err, db) {
    if(!err) {
        console.log("Connected to 'smartparking' database");
        populateDB();

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
				if(req.query.latitude && req.query.longitude && req.query.radius) {
					collection.find({
						loc: {
							$near : { 
								$geometry : {
									type : "Point",
	                                coordinates : [ parseFloat(req.query.longitude) , parseFloat(req.query.latitude) ]
	                            },
	                            $maxDistance : parseInt(req.query.radius)
	                     	}
	                    }
					}).toArray(function(err, items) {
					    callback(null, items);
					});
				} else {
					collection.find().toArray(function(err, items) {
			            callback(null, items);
			        });
			    }
		    });
		},
		parkings: function(callback) {
			db.collection('parkings', function(err, collection) {
				if(req.query.latitude && req.query.longitude && req.query.radius) {
					collection.find({
						loc: {
							$near : { 
								$geometry : {
									type : "Point",
	                                coordinates : [ parseFloat(req.query.longitude) , parseFloat(req.query.latitude) ]
	                            },
	                            $maxDistance : parseInt(req.query.radius)
	                     	}
	                    }
					}).toArray(function(err, items) {
					    callback(null, items);
					});
				} else {
					collection.find().toArray(function(err, items) {
			            callback(null, items);
			        });
			    }
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
				console.log("no update");
				collection.updateOne({'_id':parseInt(id)}, {$set: {'dernierSigneDeVie': Date.now()}}, {safe:true}, function(err, result) {
						res.status(200).end();
				});
			}
		});
	});
};

exports.manage = function(req, res) {
	if(req.query.reset) {
		console.log('Reset');
		populateDB();
		res.status(200).end();
	}
	if(req.query.generate) {
		console.log('Generate: '+req.query.generate);
		if(req.query.generate > 0) {
			generate(req.query.generate);
		}
		countSensors(function(nb) {
			res.status(200).send(nb + ' sensors');
		});
	}
	if(req.query.simulate) {
		console.log('Simulate: '+req.query.simulate);
		simulate(req.query.simulate);
		res.status(200).end();
	}
};

// ----------------------------------------
// ----------------------------------------

function updateParkings() {
	https.get({
		hostname: 'download.data.grandlyon.com',
		path: '/wfs/rdata?SERVICE=WFS&VERSION=2.0.0&outputformat=GEOJSON&request=GetFeature&typename=pvo_patrimoine_voirie.pvoparkingtr&SRSNAME=urn:ogc:def:crs:EPSG::4326',
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
					parking.loc = f.geometry;
					parking._id = parking.pkgid;
					delete parking.pkgid;
					return parking;
				});
				//console.log(parkings);
				db.collection('parkings', function(err, collection) {
	        		parkings.forEach(function(parking) {
	        			collection.save(parking);
	        		});
	        		collection.ensureIndex( { loc: "2dsphere" }, function(err, result) {
	        			if(err) {
	        				console.log(err);
	        			}
	        		});
	        		console.log('Parkings updated');
				});
			} catch(e) {
				console.log('Error when updating parking data : ' + e);
			}
		});
	});
}

function generate(n) {
	var minLat = 45.720935;
	var maxLat = 45.787051;
	var minLon = 4.788086;
	var maxLon = 4.887993;
	
	var sensors = [];

	for(var i=0;i<n;i++) {
		sensors.push({
	        etat: "libre",
	        idRue: 100000,
	        derniereMaj: Date.now(),
			dernierSigneDeVie: Date.now(),
			adresse: 'Adresse inconnue',
			loc: {
		        	type: "Point",
		        	coordinates: [ minLon + Math.random() * (maxLon - minLon), minLat + Math.random() * (maxLat - minLat) ]
		        }
	    });
	}
	db.collection('sensors', function(err, collection) {
	    collection.insert(sensors, {safe:true}, function(err, result) {
	    	if(err) {
	    		console.log(err);
	    	}
	    });
	});
}

function normalizeLongitude(lon) {
    var n = Math.PI;
    if (lon > n) {
        lon = lon - 2 * n
    } else if (lon < - n) {
        lon = lon + 2 * n
    }
    return lon;
}

function rad(dg) {
    return (dg * Math.PI / 180);
}

function deg(rd) {
    return (rd * 180 / Math.PI);
}

function countSensors(callback) {
	db.collection('sensors', function(err, collection) {
		collection.count({}, function(error, numOfDocs) {
			callback(numOfDocs);
		});
	});
}

var intervalId = null;
function simulate(interval) {
	if(intervalId === null && interval > 0) {
		db.collection('sensors', function(err, collection) {
			collection.count({}, function(error, numOfDocs){
				// Simulation
				intervalId = setInterval(function() {
					var id = Math.floor((Math.random() * (numOfDocs - 1)) + 2);
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
				}, interval);
			});
		});
	} else if(intervalId !== null && interval == 0) {
		clearInterval(intervalId);
		intervalId = null;
	}
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
		        idRue: i,
		        derniereMaj: Date.now(),
				dernierSigneDeVie: Date.now(),
				adresse: 'Adresse inconnue',
				loc: {
		        	type: "Point",
		        	coordinates: [ c[1], c[0] ]
		        }
	    	}
	    }));
	}
    
    db.collection('sensors', function(err, collection) {
    	collection.deleteMany({}, function(err, results) {
	        collection.insert(sensors, {safe:true}, function(err, result) {
	        	collection.ensureIndex( { loc: "2dsphere" }, function(err, result) {
	        		if(err) {
	        			console.log(err);
	        		}
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
			        	https.get('https://maps.googleapis.com/maps/api/geocode/json?latlng='+sensor.loc.coordinates[1]+','+sensor.loc.coordinates[0]+'&sensor=true', function(res) {
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
		        });
	        });
		});
    });
};
