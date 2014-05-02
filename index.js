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
var ejs = require('ejs');
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

    app.set('views', static_dir + '/views');
    app.engine('html', require('ejs').renderFile);

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

app.get('/get_time_table', function(req, res){
    var id = uuid.v4();

    suggest.get_airport(req.query.airport, function(e,airports){
        if(1!=airports.length||e){
            return res.json([e||'Нет аэропорта: '+req.query.airport]);
        }

        suggest.get_airline(req.query.airline, function(e,airlines){
            if(req.query.airline){
                if(1!=airlines.length||e){
                    return res.json([e||'Нет авиакомпании: '+req.query.airline]);
                }
            }

            var redis_obj = { result: false };
            client.set(id, JSON.stringify(redis_obj), function(e){
                if(e) {
                    return res.json([e]);
                }

                get_time_table(req.query, function(e, data){
                    if(e) {
                        console.error(e);
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

                res.redirect('/get_time_table/'+id);
            });
        });
    });
});

app.get('/get_time_table/:id', function(req, res){

    if(-1!=Object.keys(req.query).indexOf('data')){
        return client.get(req.params.id, function(e,redis_json){
            var redis_obj = JSON.parse(redis_json);

            res.json( redis_obj );
        });
    }

    res.render('index.html', {data_url: '/get_time_table/'+req.params.id+'?data'});
});
