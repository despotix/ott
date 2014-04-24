require('date-utils');
var request = require('request');

module.exports = function (req_obj, cb) {
    var now = new Date();
    var tm_diff = (req_obj.airline)?12:4;

    // время с которого начинать отображение
    var tm_start = new Date(now.getTime()).addHours(-tm_diff);
    var tm_end = new Date(now.getTime()).addHours(tm_diff);
    //console.log(tm_start.toFormat('YYYY-MM-DD HH24:MI'), tm_end.toFormat('YYYY-MM-DD HH24:MI'), req_obj);

    var rq_date_arr = [ tm_start ];
    if(tm_start.toYMD()!=tm_end.toYMD()){
        rq_date_arr.push(tm_end);
    }
    var cnt_html = rq_date_arr.length;

    var rs_arr_html = [];

    for(var i in rq_date_arr){
        send_request(create_request(
            req_obj.airport,
            req_obj.airline,
            rq_date_arr[i].toYMD(),
            '-1', // default
            (req_obj.direction=='departures')?0:1
        ), parse_query_type);
    }

    function parse_query_type(){
        rs_arr_html.push(arguments);
        if(rs_arr_html.length!=cnt_html){
            return;
        }

        for(var i in rs_arr_html){
            if(rs_arr_html[i][0]){
                console.log(rs_arr_html[i][0]);
                continue;
            }

            var html = rs_arr_html[i][1];
            var rq = rs_arr_html[i][2];

            var a = get_query_type_arr(tm_start, tm_end, rq.obj.airportQueryDate, html);
            cnt_html += a.length;
            for(var i in a){
                send_request(create_request(
                    rq.obj.airport,
                    rq.obj.airlineToFilter,
                    rq.obj.airportQueryDate,
                    a[i],
                    rq.obj.airportQueryType
                ), parse_time_table);
            }
        }
    }

    function parse_time_table(){
        rs_arr_html.push(arguments);
        if(rs_arr_html.length!=cnt_html){
            return;
        }

        //console.log('all received!');

        var time_table = [];
        for(var i in rs_arr_html){
            if(rs_arr_html[i][0]){
                console.log(rs_arr_html[i][0]);
                continue;
            }

            var html = rs_arr_html[i][1];
            var rq = rs_arr_html[i][2];

            time_table = time_table.concat( get_time_table(rq.obj.airportQueryDate, html) );
        }

        //console.log(time_table);

        // фильтрую результат по датам - исключаю те варианты что не должны включаться в результат
        // такое возможно в 2х случаях
        // 1) 0600 - 1200, а нам нужно до 0800
        // 2) в полученные данные на этапе parse_query_type с дефалтным airportQueryTime==-1 не попали искомые время/даты

        var result = [];
        var uniquer = {};
        for(var i in time_table){
            var tt = time_table[i];

            if( tt.sheduled.between(tm_start, tm_end) ){
                // украшаю даты
                tt.sheduled = tt.sheduled.toFormat('DD/HH24:MI');
                if(tt.actual) tt.actual = tt.actual.toFormat('DD/HH24:MI');
                if(!uniquer[tt.flight]){
                    uniquer[tt.flight] = true;
                    result.push(tt);
                }
                //console.log('added', tt);
            } else {
                //console.log('skipped', tt.sheduled);
            }
        }
        cb(null, result);
    }
};

function create_request(airport, airlineToFilter, airportQueryDate, airportQueryTime, airportQueryType){
    var ap = airport;
    if(-1!=ap.indexOf('(')){
        ap = ap.replace(/^.*\((.+)\).*$/, '$1');
    }
    var al = airlineToFilter;
    if(-1!=al.indexOf('(')){
        al = al.replace(/^.*\((.+)\).*$/, '$1');
    }
    var rq_pars = {
        airport: ap,
        airlineToFilter : al,
        airportQueryType : airportQueryType,
        airportQueryDate : airportQueryDate,
        airportQueryTime : airportQueryTime
    };
    //console.log('create_request', rq_pars);
    var url = "http://www.flightstats.com/go/FlightStatus/flightStatusByAirport.do";
    var a = [];
    for(var j in rq_pars){
        a.push(j+'='+rq_pars[j]);
    }
    url += '?'+ a.join('&');
    return {
        obj: rq_pars,
        url: url
    };
}

function send_request(rq, cb){
    console.log(rq.url);
    request.get(
        //"http://www.flightstats.com/go/FlightStatus/flightStatusByAirport.do?airport=KBP&airportQueryDate=2014-04-24&airportQueryTime=18&airlineToFilter=&airportQueryType=1",
        rq.url,
        function (err, res, body) {
            cb(err, body, rq);
        }
    );
}

function get_query_type_arr(tm_start, tm_end, ymd, html){
    var s = html.replace(/\s+/g, ' ');
    var query_type_arr = {};
    var select_arr = s.match(/<select\s+.*?<\/select>/g);
    for(var i in select_arr){
        var select = select_arr[i];
        if(-1!=select.indexOf('id="airportQueryTime"')){
            var option_arr = select.match(/<option\s+.*?<\/option>/g);
            for(var j in option_arr){
                var option = option_arr[j];
                var val = option.replace(/.*value="(\d+)".*/, '$1');
                if(-1!=option.indexOf('selected="selected"')) {
                    console.log('got for ', option);
                    continue;
                }
                if(-1!=option.indexOf('value="-1"')) continue;

                var option_tm = option.match(/\d{4}/g);
                var option_tm_start = new Date(ymd+option_tm[0].replace(/(\d+)(\d{2})/, ' $1:$2'));
                var option_tm_end = new Date(ymd+option_tm[1].replace(/(\d+)(\d{2})/, ' $1:$2')).addDays( ('0000'==option_tm[1])?1:0 );

                console.log(dt.toYMD(), option, 'current: ', option_tm_start.toFormat('DD/HH24:MI'), '-', option_tm_end.toFormat('DD/HH24:MI'), '; need:',
                 tm_start.toFormat('DD/HH24:MI'), '-', tm_end.toFormat('DD/HH24:MI'));

                // текущий заканчивается до начала искомого
                if(option_tm_end.getTime()<tm_start.getTime()) continue;
                // текущий начинается после окончания искомого
                if(option_tm_start.getTime()>tm_end.getTime()) continue;

                query_type_arr[ val ] = true;
            }
            break;
        }
    }

    query_type_arr = Object.keys(query_type_arr);
    console.log(query_type_arr);
    return query_type_arr;
}

function get_time_table(dt_ymd, html){
    var result = [];

    var s = html.replace(/\s+/g, ' ');
    var a = s.split(/<tr/);
    var got_header = false;
    for(var i in a){
        var tr_html = '<tr' + a[i].split(/\/tr>/)[0] + '/tr>';

        if(-1!=tr_html.indexOf('class="tableHeader"')){
            got_header = true;
            continue;
        }

        if(got_header){
            var tr_text = tr_html.replace(/<\/td>/g, '|');
            tr_text = tr_text.replace(/<[^>]+>/g, '');
            var tr_text_arr = tr_text.split('|');
            for(var j in tr_text_arr){
                tr_text_arr[j] = tr_text_arr[j].replace(/^\s*/, '').replace(/\s*$/, '');
            }
            var o = {};
            o.destination = tr_text_arr[0].replace(/^.*([A-Z]{3,}).*$/, '$1');
            o.flight = tr_text_arr[1].replace(/^.*([0-9A-Z]{2,})\s+([0-9]+)(\^?).*$/, '$1 $2$3');
            o.airline = tr_text_arr[3].replace(/^\s*/, '').replace(/\s*$/, '');

            var sheduled = tr_text_arr[4].replace(/^[^\d]*(\d+:\d+).*([A|P]M).*$/, ' $1 $2');
            o.sheduled = new Date(dt_ymd + sheduled);
            if(isNaN(o.sheduled.getTime())){
                console.log('Не удалось распарсить', tr_text_arr[4]);
                o.sheduled = null;
            }
            var actual = tr_text_arr[5].replace(/^[^\d]*(\d+:\d+).*([A|P]M).*$/, ' $1 $2');
            if(actual){
                o.actual = new Date(dt_ymd + actual);
                if(isNaN(o.actual.getTime())){
                    console.log('Не удалось распарсить', tr_text_arr[5]);
                    o.actual = null;
                }
            } else {
                o.actual = null;
            }

            o.gate = tr_text_arr[6];
            o.status = tr_text_arr[7].replace(/\s*&nbsp;\s*/g, ' ').replace(/^\s*/, '').replace(/\s*$/, '');

            result.push(o);
        }

        if(-1!=tr_html.indexOf('class="lastRow"')){
            break;
        }
    }

    return result;
}
