/**
 * Simple Node.js script to run the WHOOP SDK integration test
 * Run with: node test/run-test.js
 */

const { runIntegrationTest } = require('./integration-test');

runIntegrationTest().catch(console.error); 