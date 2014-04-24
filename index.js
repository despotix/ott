process.on('uncaughtException', function (ce) {
    if (!(ce instanceof Error)) {
        ce = new Error(ce);
    }
    console.log(ce.stack);
});

var suggest = require('./suggest');
var get_time_table = require('./get_time_table');

var uuid = require('node-uuid');
var express = require('express');
var redis = require('redis');

var client = redis.createClient();
var app = express();
var static_dir = process.cwd() + '/static';
app.configure(function () {

    app.setMaxListeners(0);
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(static_dir));

    app.use(function (e, req, res, next) {
        // обезопасим себя ибо тут может вылететь в корку
        if(e) console.log(e.stack||e);

        try {
            res.json([e]);
        } catch (ce) {
            console.log(ce.stack||ce);
        }
    });
});
// \конфигурю express ( в скобочках чтою красивее )

// запускаю сервачек
app.listen(8888, function () {
    console.log('started at ', 8888);
});
// \запускаю сервачек

app.get('/suggest/airline/:name', function(req, res){
    suggest.get_airline(req.params.name, function(){
        res.json(arguments);
    });
});

app.get('/suggest/airport/:name', function(req, res){
    suggest.get_airport(req.params.name, function(){
        res.json(arguments);
    });
});

app.post('/get_time_table', function(req, res){
    var id = req.body._id;
    if(!id){
        id = uuid.v4();

        var redis_obj = { result: false };
        client.set(id, JSON.stringify(redis_obj), function(e){
            if(e) {
                return res.json([e]);
            }

            get_time_table(req.body, function(e, data){
                if(e) {
                    redis_obj.error = e;
                } else {
                    redis_obj.result = data;
                }
                client.set(id, JSON.stringify(redis_obj), function(e){
                    if(e){
                        console.log('Error saving result/error:', e.stack||e);
                    }
                });
            });

            res.send(200, [null, id]);
        });
    } else {
        client.get(id, function(e,redis_json){
            if(e) return res.json([e]);

            var redis_obj = JSON.parse(redis_json);

            if(redis_obj.error){
                return res.json([e]);
            }

            res.json([null, id, redis_obj.result]);
        });
    }
});
