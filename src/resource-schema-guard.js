export const RESOURCE_KEY='molecule-craft.resources.v1';
export const SCHEMA_VERSION=9;
export const FUTURE_RESOURCES_MESSAGE='新しい版の保存データを保護しています。現在のアプリでは変更できません。アプリを更新してください。';

export function isFutureResourcesSchemaVersion(version){return Number.isInteger(version)&&version>SCHEMA_VERSION;}

export function futureResourcesSchemaVersion(rawOrValue){
  let value=rawOrValue;
  if(typeof value==='string'){
    try{value=JSON.parse(value);}catch{return null;}
  }
  if(!value||typeof value!=='object'||Array.isArray(value)||!isFutureResourcesSchemaVersion(value.schemaVersion))return null;
  return value.schemaVersion;
}
export const isFutureResourcesSave=rawOrValue=>futureResourcesSchemaVersion(rawOrValue)!==null;

export class UnsupportedFutureResourcesSchemaError extends Error{
  constructor(schemaVersion){
    super(`Unsupported future resources schema ${schemaVersion}`);
    this.name='UnsupportedFutureResourcesSchemaError';
    this.schemaVersion=schemaVersion;
  }
}

export function assertSupportedResourcesSchema(value){
  if(isFutureResourcesSchemaVersion(value?.schemaVersion))throw new UnsupportedFutureResourcesSchemaError(value.schemaVersion);
  return value;
}
