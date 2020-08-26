# Kentico Kontent SharePoint Word Sync

Sample SharePoint Word add-in and Azure Function code that uses the Kontent Management API to sync text to a rich text element in a new content item.

The code in this repository is configured for Azure Functions, however it can be lifted to any web application running ASP.NET Core 3.1.

## Setup

1. Deploy the Azure Function code in `Functions.sln` to an Azure Function. See the [Function Settings](#function-settings) section for additional configuration steps.
1. Add configuration values to `Client/src/config.json`. See the [JSON parameters](#json-parameters) section for details.
1. Deploy the add-in code in `Client/` to a secure public host.
   - See the [Deploying](#Deploying) section for a really quick option.
1. Update `KenticoKontentSharePointWordSync.xml` with the hosts' domains.
1. Follow the instructions in [Sideload Office Add-ins in Office on the web for testing](https://docs.microsoft.com/en-us/office/dev/add-ins/testing/sideload-office-add-ins-for-testing) to install the add-in to Word Online.

## Function Settings

The Azure Function code requires two settings: `ProjectId` and `ManagementApiKey`. You can either [set them using Visual Studio](https://docs.microsoft.com/en-us/azure/azure-functions/functions-develop-vs#function-app-settings) or [use the options here](https://docs.microsoft.com/en-us/azure/azure-functions/functions-how-to-use-azure-function-app-settings#settings).

## Deploying

Netlify has made this easy. If you click the deploy button below, it will guide you through the process of deploying it to Netlify and leave you with a copy of the repository in your GitHub account as well.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/yuriys-kentico/KenticoKontentSharePointWordSync)

## JSON Parameters

`projectId` is a `string` defining the project ID.
`languageCodename` is a `string` defining the codename of the language you want your items to be created in.
`getTypesEndpoint` is a `string` defining the Azure Function URL appended with `/getTypes`.
`syncEndpoint` is a `string` defining the Azure Function URL appended with `/sync`.

Example JSON parameters object:

```json
{
  "projectId": "abc00b4e-175f-00f2-ac75-392d3bcbc6ff",
  "languageCodename": "en-US",
  "getTypesEndpoint": "https://sample-kontent-sharepoint-word-sync.azurewebsites.net/getTypes",
  "syncEndpoint": "https://sample-kontent-sharepoint-word-sync.azurewebsites.net/sync"
}
```
