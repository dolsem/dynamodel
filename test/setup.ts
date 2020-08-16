import { setDDB } from 'dynamodel';
import { DynamoDB } from 'aws-sdk';

export const ddb = new DynamoDB({
  endpoint: 'http://localhost:8000',
  region: 'us-west-1',
  credentials: { accessKeyId: 'key-id', secretAccessKey: 'key' },
});
setDDB(ddb);
