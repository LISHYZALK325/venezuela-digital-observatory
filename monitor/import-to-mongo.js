#!/usr/bin/env node
/**
 * Import status.json to MongoDB
 * Usage: node import-to-mongo.js [path-to-status.json]
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ve_monitor';
const DEFAULT_FILE = process.env.OUTPUT_FILE || path.join(__dirname, 'status.json');

async function importToMongo(jsonPath) {
  const filePath = jsonPath || DEFAULT_FILE;

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`Reading: ${filePath}`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  if (!data.domains || !data._meta) {
    console.error('Invalid status.json format');
    process.exit(1);
  }

  const { _meta, domains } = data;
  console.log(`Found ${domains.length} domains, generated at ${_meta.generatedAt}`);

  // Check if already imported (by generatedAt timestamp)
  const checkedAt = new Date(_meta.generatedAt);

  let client;
  try {
    console.log(`Connecting to MongoDB: ${MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
    client = new MongoClient(MONGO_URI);
    await client.connect();

    const db = client.db();
    const checksCollection = db.collection('ve_monitor_checks');
    const domainsCollection = db.collection('ve_monitor_domains');

    // Check if this check already exists
    const existing = await checksCollection.findOne({
      checkedAt: {
        $gte: new Date(checkedAt.getTime() - 60000),
        $lte: new Date(checkedAt.getTime() + 60000)
      }
    });

    if (existing) {
      console.log(`Check from ${_meta.generatedAt} already exists in DB (id: ${existing._id})`);
      console.log('Skipping import to avoid duplicates.');
      return;
    }

    // Create indexes
    await domainsCollection.createIndex({ domain: 1, checkedAt: -1 });
    await domainsCollection.createIndex({ checkId: 1 });
    await domainsCollection.createIndex({ checkedAt: -1 });
    await checksCollection.createIndex({ checkedAt: -1 });

    // Parse duration (e.g., "5841.0s" -> 5841.0)
    const checkDuration = parseFloat(_meta.checkDuration) || 0;

    // Insert check record
    const checkRecord = {
      checkedAt,
      checkDuration,
      summary: {
        totalDomains: _meta.totalDomains,
        online: _meta.online,
        offline: _meta.offline,
        withSSL: _meta.withSSL,
        validSSL: _meta.validSSL,
        avgResponseTime: _meta.avgResponseTime
      }
    };

    const checkResult = await checksCollection.insertOne(checkRecord);
    const checkId = checkResult.insertedId;
    console.log(`Inserted check record: ${checkId}`);

    // Prepare domain records
    const domainRecords = domains.map(d => ({
      checkId,
      checkedAt: d.checkedAt ? new Date(d.checkedAt) : checkedAt,
      domain: d.domain,
      status: d.status,
      httpCode: d.httpCode,
      responseTime: d.responseTime,
      error: d.error || null,
      ssl: d.ssl,
      headers: d.headers,
      redirects: d.redirects,
      finalUrl: d.finalUrl
    }));

    // Bulk insert
    await domainsCollection.insertMany(domainRecords);
    console.log(`Inserted ${domainRecords.length} domain records`);

    // Show totals
    const totalChecks = await checksCollection.countDocuments();
    const totalDomainRecords = await domainsCollection.countDocuments();
    console.log(`Total in DB: ${totalChecks} checks, ${totalDomainRecords} domain records`);

  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Run
const jsonPath = process.argv[2];
importToMongo(jsonPath)
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
