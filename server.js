var express = require('express');
var escape = require('escape-html');
var http = require('http');
var redis = require('redis');

var db = redis.createClient(process.env.REDIS_URL);
var app = express();

app.configure(function(){
    app.use(express.bodyParser());
    app.use(express.static(__dirname + '/static'));
});

app.get('/api/', function(req, res) {
    db.smembers('triages', function(err, data) {
        data = data ? data : [];
        res.json({'size': data.length, 'entries': data.reverse()});
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
    var entries = [];
    var count = 0;

    db.zrange(key, 0, -1, function(err, data) {
        count = data.length++;
        for (var i = 0; i < data.length - 1; i++) {
            function get(url) {
                db.hget(url, 'title', function(err, title) {
                    count--;
                    entries.push({'url': url, 'title': title});
                    if (!count) {
                        res.json({'size': entries.length, 'entries': entries});
                        res.status(200);
                        res.end();
                    }
                });
            };
            get(data[i]);
        }
    });
});

app.post('/api/:key/', function(req, res) {
    var key = 'triage:' + req.params.key;
    var prefix = new RegExp('^(https://bugzilla.mozilla.org/|https://github.com/)');
    if (!prefix.test(req.body.url)) {
        res.status(400);
    } else {
        db.hset(escape(req.body.url), 'title', escape(req.body.title));
        db.zadd(key, 1, escape(req.body.url), function(err, data) {
            if (data) {
                db.publish(key, escape(req.body.url));
            }
            res.status(201);
            res.end();
        });
    }
    res.end();
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
        db.hget(message, 'title', function(err, title) {
            messageCount++;
            res.write('id: ' + messageCount + '\n');
            res.write('data: ' + JSON.stringify({'url': message, 'title': title}) + '\n\n');
        });
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

app.listen(process.env.PORT || 3000);
