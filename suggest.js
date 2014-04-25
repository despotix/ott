var request = require('request');

global.airports = [];
global.airlines = [];

module.exports = (function () {
    function get_names(code, type, cb) {
        code = code.toUpperCase();

        if(global[type][code]){
            return cb(global[type][code]);
        }

        request({
            url : 'http://www.flightstats.com/go/Suggest/'+type+'Suggest.do?responseType=json&desiredResults='+('airport'==type?'100':'50')+'&term='+code,
            headers : {
                'Referer' :'http://www.flightstats.com/go/Home/home.do'
            }
        }, function(e,res,body){
            var a = JSON.parse( body );
            var r = [];
            for(var i in a){
                if(0==a[i].id.indexOf(code)){
                    r.push(a[i].id);
                }
            }
            r = r.sort();
            global[type][code] = r;
            cb(null, r);
        });
    }

    return {
        get_airport: function (ap_name, cb) {
            get_names(ap_name, 'airport', cb);
        },
        get_airline: function get_airline(al_name, cb) {
            get_names(al_name, 'airline', cb);
        }
    };
})();

