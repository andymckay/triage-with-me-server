var express = require('express');
var escape = require('escape-html');
var http = require('http');
var redis = require('redis');

function get_client() {
    if (process.env.VCAP_SERVICES) {
        var redisconf = JSON.parse(process.env.VCAP_SERVICES)['redis'][0]['credentials'];
        var db = redis.createClient(redisconf.port,
                                redisconf.host);
        db.auth(redisconf.password);
    } else {
        var db = redis.createClient();
    }
    return db;
}

var db = get_client();
var app = express();

app.configure(function(){
    app.use(express.bodyParser());
    app.use(express.static(__dirname + '/static'));
});

app.get('/api/', function(req, res) {
    db.smembers('triages', function(err, data) {
        data = data ? data : [];
        res.json({'size': data.length, 'entries': data});
        res.status(200);
        res.end();
    });
});

app.post('/api/', function(req, res) {
    var key = Date.now();
    db.sadd('triages', (key).toString(), function(err, data) {
        res.json({'key': key});
        res.end();
    });
});

app.get('/api/:key/', function(req, res) {
    var key = 'triage:' + req.params.key;
    db.smembers(key, function(err, data) {
        res.json({'size': data.length, 'entries': data});
        res.status(200);
        res.end();
    });
});

app.post('/api/:key/', function(req, res) {
    var key = 'triage:' + req.params.key;
    db.sadd(key, escape(req.body.url), function(err, data) {
        if (data) {
            db.publish(key, escape(req.body.url));
        }
        res.status(201);
        res.end();
    });
});

app.get('/api-events/:key/', function(req, res) {
    var messageCount = 0;
    var subscriber = get_client();
    var key = 'triage:' + req.params.key;

    function keep_alive() {
        res.write(':keep-alive\n');
        setTimeout(keep_alive, 5000);
    }

    subscriber.subscribe(key);

    req.socket.setTimeout(Infinity);

    subscriber.on('message', function(channel, message) {
        messageCount++;
        res.write('id: ' + messageCount + '\n');
        res.write('data: ' + message + '\n\n');
    });

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    res.write('\n');
    keep_alive();

    req.on('close', function() {
        subscriber.unsubscribe();
        subscriber.quit();
    });
});

app.listen(3000);
