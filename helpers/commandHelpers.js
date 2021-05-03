//
// Imports
//
import { exec } from 'child_process';

//
// Quick function that wraps a promise with a timeout
//
const timeout = (prom, time, error) =>
  Promise.race([prom, new Promise((_r, rej) => setTimeout(function () { rej(error) }, time))]);

//
// Wrapper for executing a command on the system
//
export function executeCommand(command, timeoutInMs) {
  var commandPromise = new Promise((done, reject) => {
    exec(command, (err, stdout, stderr) => {

      if (err)
        reject(err);

      done({
        stdout: stdout,
        stderr: stderr
      });
    });
  });

  if (!timeoutInMs)
    return commandPromise;
  else
    return timeout(commandPromise, timeoutInMs, `Timed out waiting for '${command}' to finish executing`);
};

//
// Creates a kubernetes namespace if one doesn't exist
//
export async function safelyCreateKubeNamespace(namespaceName) {
  await executeCommand(`kubectl create ns ${namespaceName} --dry-run -o yaml | kubectl apply -f -`);
}

function buildKubernetesCommand(command, cliOptions){
  // Build up a field selector string based on namespaces to ignore
  if (cliOptions && cliOptions.ignoreNamespaces) {

    var fields = '';
    var namespacesArr = cliOptions.ignoreNamespaces.split(',');

    // Build up fields for field selector
    for (const index in namespacesArr) {
      if (command.match(/get ns/i))
        fields += `metadata.name!=${namespacesArr[index]},`;
      else
        fields += `metadata.namespace!=${namespacesArr[index]},`;
    }

    // Remove trailing comma
    fields = fields.replace(/,\s*$/, "");

    // Construct field selector and inject into command
    var fieldSelector = `--field-selector ${fields}`;
    command = `${command} ${fieldSelector}`;
  }

  return command;
}

export async function getKubernetesJson(command, cliOptions) {

  var newCommand = buildKubernetesCommand(command, cliOptions);  

  // Execute the command as json
  var results = await executeCommand(`${newCommand} -o json`);

  // Parse results and return
  return JSON.parse(results.stdout);
}

export async function doesResourceExist(resourceName, cliOptions) {

  var getKubernetesText = async (command, cliOptions) => {
    
    var newCommand = buildKubernetesCommand(command, cliOptions); 

    var results = await executeCommand(newCommand);

    // Parse results and return
    return results.stdout;
  }

  try {
    var result = await getKubernetesText(`kubectl api-resources | awk -F ' ' '{ print $1 }' | grep '${resourceName}'`, cliOptions);
  }
  catch {
    return result? true: false;
  }
  finally {
    return false;
  }  
}

