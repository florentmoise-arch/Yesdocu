function escapeXml(s){
  return String(s).replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
}
function buildMinimalJDF(jobName, { copies=1, sides='one-sided' } = {}){
  return `<?xml version="1.0" encoding="UTF-8"?>
<JDF xmlns="http://www.CIP4.org/JDFSchema_1_1" Type="Combined" Types="Interpreting Rendering" ID="YesDocu-${Date.now()}" Status="Waiting" Version="1.3" JobPartID="YesDocuPart" JobID="${escapeXml(jobName)}">
  <ResourcePool>
    <RunList Class="Parameter" ID="RunList_1">
      <FileSpec URL="${escapeXml(jobName)}"/>
    </RunList>
    <LayoutPreparationParams Class="Parameter" ID="LPP_1" Sides="${sides}"/>
    <Component Class="Quantity" ID="Component_1" ComponentType="FinalProduct" Amount="${copies}"/>
  </ResourcePool>
  <ResourceLinkPool>
    <RunListLink rRef="RunList_1" Usage="Input"/>
    <LayoutPreparationParamsLink rRef="LPP_1" Usage="Input"/>
    <ComponentLink rRef="Component_1" Usage="Output"/>
  </ResourceLinkPool>
</JDF>`;
}
module.exports = { buildMinimalJDF };
