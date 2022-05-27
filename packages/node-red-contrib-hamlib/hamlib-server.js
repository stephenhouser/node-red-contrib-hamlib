/* hamlib-server.js - NodeRed configuration node for HamLib nodes
 *
 * 2022/05/26 Stephen Houser, MIT License
 */
const net = require('net');
const log_info = function(msg) { console.log(msg); };
const log_debug = function(msg) { console.log(msg); };

// Unique ID for use in debugging connections, events, etc.
let node_id = 1;

module.exports = function(RED) {
	'use strict';

	function HamlibServerNode(config) {
		RED.nodes.createNode(this, config);
		const node = this;

		// Assign this object a unique ID that will show in debug messages
		// Makes for easy assocaition of events, etc..
		node.node_id = node_id++;
		log_debug(`hamlib-server[${node.node_id}].create()`);

		node.name = config.name;
		node.connectionState = 'disconnected';
		node.timeoutSeconds = config.timeout || 15;

		// queue of requests to Hamlib server process, [{request, callback}, ...]
		node.requests = [];

		// Allows any number of listeners to attach. Default is 10
		// which is way too few for many flows. Each outer node needs a
		// number of listeners to do it's job.
		node.setMaxListeners(0);

		node.connect = function() {
			log_debug(`hamlib-server[${node.node_id}].connect(${config.host}, ${config.port})`);
			node.connectionState = 'connecting';
			node.connection = net.connect(config.port, config.host, function() {
				log_info(`hamlib-server[${node.node_id}].connection.on('connect')`);
				node.connection.setEncoding('utf8');

				node.connectionState = 'connected';

				node.connection.on('data', function(data) {
					log_debug(`hamlib-server[${node.node_id}].on('data')`);
					console.log(`RECV< ${data}`);

					// resolve current request and send next one if in queue
					const request = node.requests.shift();
					if (request && request.callback) {
						request.callback({
							request: request.request,
							payload: data 
						});
					}

					node.sendQueued();
				});

				node.connection.on('error', function(error) {
					// Called when there is an error on the channel
					// MUST be handled by a listener somewhere or will
					// CRASH the program with an unhandled exception.
					console.error(`hamlib-server[${node.node_id}].connection.on('error')`);
				});
	
				node.connection.on('close', function() {
					log_info(`hamlib-server[${node.node_id}].connection.on('close')`);
					node.connectionState = 'disconnected'
				});
			});
		};

		node.sendQueued = function() {
			log_debug(`hamlib-server[${node.node_id}].sendQueued(${JSON.stringify(node.requests)})`);
			if (node.requests.length) {
				const request = node.requests[0];
				if (request && request.request && !request.sent) {
					console.log(`SEND> ${request.request}`);
					node.connection.write(request.request + '\n');
					request.sent = true;
				}
			}
		};

		node.disconnect = function() {
			if (node.connectionState == 'connected') {
				node.connection.destroy();
			}
		};

		node.on('close', function(done) {
			log_debug(`hamlib-server[${node.node_id}].on.close()`);
			node.disconnect();
			done();
		});

		node.send = function(msg, response_handler) {
			if (!msg || !msg.payload) {
				return false;
			}

			log_debug(`hamlib-server[${node.node_id}].send(${msg.payload})`);
			const requests = Array.isArray(msg.payload) ? msg.payload : [msg.payload];
			while (requests.length) {
				const request = requests.shift();
				log_debug(`Queue "${request}" from msg.id=${msg.id}`);
				node.requests.push({
						request: request, 
						callback: response_handler
					});
			}

			node.sendQueued();
			return true;
		};

		node.connect();
	}

	RED.nodes.registerType('hamlib-server', HamlibServerNode);
};
