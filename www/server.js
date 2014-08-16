var config ='';
var static = require('node-static');
var http = require('http');
var crypto = require('crypto');
var file = new(static.Server)();
var sessions = new Array();
var static = require('node-static');
var http = require('http');
var file = new(static.Server)();
var irc = require('irc');
var redis = require('redis');
var redisClient;
var client; //client irc
//loading configuration
require('fs').readFile('config.json', 'utf-8', function(err, data)
    {
        config = JSON.parse(data);
        createServer();
    });

function createServer()
{
    startRedis(redis);
    startIRC(irc);
    var app = http.createServer(function (req, res) {
        file.serve(req, res);
    }).listen(config.web.port);


///////////////////////////////////the connection to the webclients logic///////////////////////////////////////////////
    io = require('socket.io').listen(app);
    io.sockets.on('connection', function (socket)
    {
        socket.on('submitconnect', function (serialized)
        {
            data = JSON.parse(serialized);
            if (data.user.toLowerCase() === config.web.login.toLowerCase() && data.password === config.web.password)
            {
                //on genere un token de session a partir de l'ip et de bruit (pas sécurisé d'un point de vue chiffrement mais suffisant)
                var sessionToken = generateSessionToken(socket.handshake.address);
                sessions[sessionToken] = {
                    "connected": true
                };
                console.log(sessionToken);
                socket.room = 'logged';
                socket.join(socket.room);
                socket.emit('back', JSON.stringify({
                    "sessionId": sessionToken,
                    channels: config.irc.channels,
                    pseudo : config.irc.user
                }));
                userPseudoManagement();
            }
            else
            {
                socket.emit('back',JSON.stringify(
                {
                    "error": 'wrongAuth'
                }));
            }
        });

        socket.on('message', function(serialized)
        {
            var data = JSON.parse(serialized);
            if(data.sessionId !== undefined && data.sessionId !== null && sessions[data.sessionId] !== null && sessions[data.sessionId] !== undefined &&sessions[data.sessionId].connected === true )
            {
                if(data.command === 'names')
                {
                    names(data.channel);
                }
                else if(data.command === "topic")
                {
                    topic(data.channel);
                }
                else if(data.command === 'action')
                {
                    actionListener(config.irc.user, data.channel, data.message, null);
                    action(data.channel, data.message);
                }
                else if(data.command === 'nick')
                {
                    nick(data.message);
                }
                else
                {
                    messageListener(config.irc.user, data.channel, data.message, null);
                    say(data.channel, data.message);
                }
            }
        });

        socket.on('quit', function (serialized) {
            var data = JSON.parse(serialized);
            //TODO trouver un moyen pour deconecter les gens en cas de timeout
            //var session = sessions[data.sessionId];
            sessions = deleteFromArray(sessions, data.sessionId);
            if (sessions.length == 0)
            {
                nick(config.irc.user +'[away]');
            }


        });
    });
}
/**
 * Generate a session token in order to emulate php sessions
 * @param entropy
 * @returns String the sessionToken
 */
function generateSessionToken(entropy)
{
    var hash;
    if(entropy == undefined || entropy == null)
    {
        entropy = '';
    }
    var totalSeed = '' + entropy +  + Math.random() ;
    hash = crypto.createHash('md5').update(totalSeed).digest('hex');

    return hash;
}

function userPseudoManagement()
{
    if(config.irc.user.substring(config.irc.user.lastIndexOf("[")) === '[away]')
    {
        nick(config.irc.user.substring(0,config.irc.user.lastIndexOf("[")-1));
    }
}
////////////////////////////////////the connection to irc logic/////////////////////////////////////////////////////////
function startIRC(irc)
{
    client = new irc.Client(config.irc.server, config.irc.user,
        {
            port: config.irc.port,
            channels: config.irc.channels,
            userName: config.irc.userName,
            realName: config.irc.clientName,
            debug: false
        });

    client.addListener('registered', function (message)
    {
        var data =
        {
            type : 'connected',
            date : (new Date().getTime()),
            data: message
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('motd', function (message)
    {
        var data =
        {
            type : 'motd',
            date : (new Date().getTime()),
            data: message
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('names', function (chan, nicks)
    {
        var data =
        {
            type : 'names',
            date : (new Date().getTime()),
            channel : chan,
            data : nicks
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('topic', function (channel, topic, nick, message)
    {
        var data =
        {
            type : 'topic',
            date : (new Date().getTime()),
            channel : channel,
            from : nick,
            data :topic
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('join', function (channel, nick, message)
    {
        var data =
        {
            type : 'join',
            date : (new Date().getTime()),
            channel : channel,
            from :nick
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('part', function (channel, nick, reason, message)
    {
        var data =
        {
            type : 'part',
            date : (new Date().getTime()),
            channel : channel,
            from : nick,
            data :  reason
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('quit', function (channels, nick, reason, message)
    {
        var data =
        {
            type : 'quit',
            date : (new Date().getTime()),
            channels : channels,
            from : nick,
            data :  reason
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('kick', function (channel, nick, by, reason, message)
    {
        var data =
        {
            type : 'kick',
            date : (new Date().getTime()),
            channel : channel,
            target : nick,
            from : by,
            data :  reason
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('kill', function (nick, reason, channels, message)
    {
        var data =
        {
            type : 'kill',
            date : (new Date().getTime()),
            channels : channels,
            target : nick,
            data :  reason
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('message#', messageListener);

    client.addListener('notice', function (nick, to, text, message)
    {
        var data =
        {
            type : 'notice',
            date : (new Date().getTime()),
            from : nick,
            target : to,
            data :text
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('ping', function (server)
    {
        var data =
        {
            type : 'ping',
            date : (new Date().getTime()),
            data :server
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('pm', function (nick, text, message)
    {
        var data =
        {
            type : 'pm',
            date : (new Date().getTime()),
            from : nick,
            data :text
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('nick', function (oldnick, newnick, channels, message)
    {
        if (oldnick === config.irc.user)
        {
            config.irc.user = newnick;
        }
        var data =
        {
            type : 'nick',
            date : (new Date().getTime()),
            from : oldnick,
            to : channels,
            data :newnick
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('+mode', function (channel, by, mode, argument, message)
    {
        var data =
        {
            type : '+mode',
            date : (new Date().getTime()),
            from : by,
            to : argument,
            channel : channel,
            data :mode
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('-mode', function (channel, by, mode, argument, message)
    {
        var data =
        {
            type : '-mode',
            date : (new Date().getTime()),
            from : by,
            to : argument,
            channel : channel,
            data :mode
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('whois', function (whois)
    {
        var data =
        {
            type : 'whois',
            date : (new Date().getTime()),
            to : whois.nick,
            data :whois
        };
        storeInRedis(data);
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('error', function (error)
    {
        var data =
        {
            type : 'error',
            date : (new Date().getTime()),
            data :error
        };
        storeInRedis(data);
        console.log(JSON.stringify(data));
        io.sockets.in('logged').emit(data.type, JSON.stringify(data));
    });

    client.addListener('action', actionListener);
}

function actionListener (from, channel, message)
{
    var data =
    {
        type : (channel === config.irc.user ? 'pvtaction' :'action'),
        date : (new Date().getTime()),
        from : from,
        channel : channel,
        data :message
    };
    storeInRedis(data);
    io.sockets.in('logged').emit(data.type, JSON.stringify(data));
}

function messageListener(from, channel, text, message)
{
    var data =
    {
        type : 'message',
        date : (new Date().getTime()),
        from : from,
        channel : channel,
        data :text
    };
    storeInRedis(data);
    io.sockets.in('logged').emit(data.type, JSON.stringify(data));
}
//-----------------------------actions on IRC------------------------------------------------------------------//
function nick(newNick)
{
    client.send("NICK", newNick);
}
function names(channel)
{
    client.send("NAMES", channel);
}
function topic(channel, topic)
{
    if(topic !== null && topic !== undefined)
    {
        client.send('TOPIC', channel, topic);
    }
    else
    {
        client.send('TOPIC', channel);
    }

}
function say(target, message)
{
    client.say(target, message);
}
function join(channel)
{
    client.join(channel);
}

function part(channel, reason)
{
    client.part(channel,(reason === null || reason === undefined ? '' : reason));
}

function action(channel, text)
{
    client.action(channel, text);
}

function whois(target)
{
    client.whois(target);
}
//-----------------------------listeners------------------------------------------------------------------------//
///////////////////////////////////redis logic//////////////////////////////////////////////////////////////////////////
function startRedis(redis)
{
    redisClient = redis.createClient();
    redisClient.on("error", function (err)
    {
        console.log("Error " + err);
    });
}

function storeInRedis(data)
{
    if(data.channels)
    {
        console.log('channels');
        for(var i = 0; i < data.channels.length; i++)
        {
            storeInRedisChannel(data, data.channels[i]);
        }
    }
    else if(data.type === 'pm' || data.type === 'pvtaction')
    {
        redisClient.lpush('pvt_' + data.from.toLowerCase(), JSON.stringify(data));
    }
    else if(data.channel)
    {console.log('channel');
        storeInRedisChannel(data, data.channel);
    }
    else if (data.type === 'motd')
    {
        console.log('motd');
        redisClient.lpush('motd', JSON.stringify(data));
    }
    else if(data.type !== 'ping')
    {console.log('!ping');
        redisClient.lpush('client', JSON.stringify(data));
    }
}

function storeInRedisChannel(data, channel)
{
    redisClient.lpush('chan_' + channel.replace('#',''), JSON.stringify(data));
}

///////////////////////////////////the generic logic////////////////////////////////////////////////////////////////////


/**
 * method that delete an element from an array
 * !!!!!VERY SLOW DO NOT USE IF THERE IS AN OTHER WAY!!!!!!!!!!
 * @param position
 * @param array
 */
function deleteFromArray(array, position)
{
    var tmpArray = new Array();
    for (var i = 0; i < array.length; i++)
    {
        if(array[i] !== array[position])
        {
            tmpArray[i] = array[i];
        }
    }
    return tmpArray;
}

