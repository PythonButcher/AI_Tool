export const DATASTREAM_WORKSPACE_ID = 'datastream-workspace';

export function getWorkspacePortalContainer(ownerDocument = document) {
  return ownerDocument.getElementById(DATASTREAM_WORKSPACE_ID) ?? ownerDocument.body;
}
