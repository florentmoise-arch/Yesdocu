function jdfFor(name){
  const base = name.replace(/\.pdf$/i, '');
  return `<?xml version="1.0" encoding="UTF-8"?>
<JDF xmlns="http://www.CIP4.org/JDFSchema_1_1" Type="Product" ID="YesDocu_${base}">
  <ResourcePool>
    <RunList Class="Parameter" ID="RL_${base}">
      <LayoutElement>
        <FileSpec URL="${base}.pdf" />
      </LayoutElement>
    </RunList>
    <RunListLink rRef="RL_${base}" Usage="Input"/>
  </ResourcePool>
  <AuditPool>
    <Created AgentName="YesDocu" />
  </AuditPool>
</JDF>`;
}
module.exports = { jdfFor };