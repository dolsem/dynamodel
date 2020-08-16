import dynamoose from 'dynamoose';
export const setDDB = dynamoose.setDDB.bind(dynamoose);

export { Dynamodel } from './lib/dynamodel';
export {
  Table,
  Attribute,
  PrimaryKey,
  SecondaryKey,
} from './lib/decorators';
