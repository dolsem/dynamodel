import { Table, Attribute, PrimaryKey, SecondaryKey } from 'dynamodel';

export const Pets = Table({ name: 'Pets' });
@Pets
export class Dog extends Pets.Model {
  @PrimaryKey(0, 'name')
  @Attribute()
  name: string

  @SecondaryKey(0, 'owner')  
  @Attribute()
  owner: string;

  @SecondaryKey(1, 'breed')
  @Attribute()
  breed: string;

  @Attribute()
  yearsOld?: number;
}
