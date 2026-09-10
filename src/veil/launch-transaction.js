export function runLaunchTransaction({steps,commit,rollback}){
  let phase='prepare';
  try{
    for(const step of steps){phase=step.name;step.run();}
    phase='commit';commit();
    return true;
  }catch(error){
    rollback(error,phase);
    return false;
  }
}
