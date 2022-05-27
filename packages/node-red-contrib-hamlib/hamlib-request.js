/* hamlib-request.js - NodeRed node for sending requests/commands to Hamlib
 *
 * 2022/05/26 Stephen Houser, MIT License
 */
module.exports = function(RED) {
	'use strict';

	function HamlibRequestNode(config) {
		RED.nodes.createNode(this, config);

		const node = this;
		node.name = config.name;
		node.hamlib_server = RED.nodes.getNode(config.server);

		const hamlib_server = node.hamlib_server;
		if (!hamlib_server) {
			updateNodeStatus('not configured');
			return;
		}

		node.on('input', function(msg, send, done) {
			const rc = hamlib_server.send(msg, function(response) {
				send({ ...msg, ...response });
			});

			if (!rc) {
				send({ topic: 'error', payload: 'hamlib server not available or connected.'});
			}

			if (done) {
				done();
			}
		});

		node.on('close', (done) => {
			updateNodeStatus('closed');
			clearInterval(node.statusUpdate);
			done();
		});

		function updateNodeStatus(status) {
			switch (status) {
				case 'connecting':
					node.status({ fill: 'green', shape: 'circle', text: status });
					break;
				case 'connected':
					node.status({ fill: 'green', shape: 'dot', text: status });
					break;
				case 'disconnected':
					node.status({ fill: 'red', shape: 'dot', text: status });
					break;
				case 'not configured':
					node.status({ fill: 'black', shape: 'circle', text: status });
					break;
			}
		}

		// Update this node's status from the config node, in case we miss events
		updateNodeStatus('starting');
		node.statusUpdate = setInterval(() => {
			updateNodeStatus(hamlib_server.connectionState);
		}, 5000);
	}

	RED.nodes.registerType('hamlib-request', HamlibRequestNode);
};
