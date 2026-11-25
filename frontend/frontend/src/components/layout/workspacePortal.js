export const DEVSTREAM_WORKSPACE_ID = 'devstream-workspace';

export function getWorkspacePortalContainer(ownerDocument = document) {
  return ownerDocument.getElementById(DEVSTREAM_WORKSPACE_ID) ?? ownerDocument.body;
}
