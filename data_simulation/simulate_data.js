// simulated_data.js

const faker = require('faker');

// Configuration variables
const sim_time = 60 * 60 * 24; // simulate for one day in seconds
const encryption_status = true; // all data is encrypted in simulation
const user_behaviors = ['normal', 'suspicious', 'malicious'];
const selected_behavior = faker.random.arrayElement(user_behaviors);

// Helper functions
function generateTimestamp(startTime) {
const offset = faker.datatype.number({ min: 0, max: sim_time });
return new Date(startTime.getTime() + offset * 1000);
}

function generateFileMetadata() {
return {
fileId: faker.datatype.uuid(),
filename: faker.system.fileName(),
fileSize: faker.datatype.number({ min: 1024, max: 10485760 }), // 1KB to 10MB
fileType: faker.system mimeType(),
createdAt: generateTimestamp(startTime),
lastAccessed: generateTimestamp(startTime),
ownerId: faker.datatype.uuid(),
encrypted: encryption_status,
encryptionAlgo: encryption_status ? 'AES-256' : null
};
}

function generateAccessLog(fileMeta, userId) {
return {
logId: faker.datatype.uuid(),
userId: userId,
fileId: fileMeta.fileId,
accessType: faker.random.arrayElement(['read', 'write', 'delete']),
timestamp: generateTimestamp(startTime),
success: faker.datatype.boolean()
};
}

function generateMemorySnapshot(userId, activityType) {
return {
snapshotId: faker.datatype.uuid(),
userId: userId,
threadID: faker.datatype.number({ min: 1000, max: 9999 }),
processName: faker.system.commonFileName(),
activityType: activityType,
timestamp: generateTimestamp(startTime),
snapshotData: faker.lorem.bytes(256) // Simulated raw memory bytes
};
}

function generateUserActivity(userId) {
const activityTypes = ['login', 'logout', 'file_access', 'file_upload', 'file_download'];
const activity = {
userId: userId,
activityType: faker.random.arrayElement(activityTypes),
timestamp: generateTimestamp(startTime),
details: faker.lorem.sentence()
};
return activity;
}

// Simulation start date
const startTime = new Date();

// Generate synthetic data
const users = Array.from({ length: 3 }, () => faker.datatype.uuid()); // 3 users
const files = Array.from({ length: 5 }, () => generateFileMetadata());

const logs = [];
const memorySnapshots = [];
const userActivities = [];

// Generate logs and activities
users.forEach(userId => {
// User activity patterns based on behavior
const activityCount = faker.datatype.number({ min: 5, max: 15 });
for (let i = 0; i < activityCount; i++) {
// Generate activity
const activity = generateUserActivity(userId);
userActivities.push(activity);

// Generate access logs based on activity
if (activity.activityType === 'file_access') {
const file = faker.random.arrayElement(files);
logs.push(generateAccessLog(file, userId));
}

// Occasionally generate memory snapshots for suspicious/malicious patterns
if (selected_behavior !== 'normal' && faker.datatype.boolean()) {
memorySnapshots.push(generateMemorySnapshot(userId, activity.activityType));
}
}
});

// Output the synthetic dataset as JSON
const syntheticDataset = {
startTime: startTime.toISOString(),
encryptionFlag: encryption_status,
userBehaviorPattern: selected_behavior,
users: users,
files: files,
logs: logs,
memorySnapshots: memorySnapshots,
userActivities: userActivities
};

// Save to a JSON file
const fs = require('fs');
fs.writeFileSync('synthetic_forensics_data.json', JSON.stringify(syntheticDataset, null, 2));

console.log('Synthetic forensic data generated and saved to synthetic_forensics_data.json.');