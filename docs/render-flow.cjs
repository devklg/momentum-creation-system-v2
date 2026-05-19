// Renders flow.svg and system.svg to PNG using sharp.
// Run: node docs/render-diagrams.cjs

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const FLOW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1800 2400" font-family="Arial, sans-serif">
  <rect width="1800" height="2400" fill="#FFFFFF"/>
  <text x="900" y="60" text-anchor="middle" font-size="32" font-weight="700" fill="#0A0A0A">Team Magnificent — Full BA Cycle &amp; Access Code Genealogy</text>
  <text x="900" y="92" text-anchor="middle" font-size="16" fill="#555555" font-style="italic">From code generation through new BA onboarding through their first prospect's enrollment</text>
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#0A0A0A"/>
    </marker>
    <marker id="arrowGold" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#C9A84C"/>
    </marker>
    <marker id="arrowTeal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#2DD4BF"/>
    </marker>
  </defs>
  <rect x="40" y="120" width="200" height="36" rx="4" fill="#0A0A0A"/>
  <text x="140" y="144" text-anchor="middle" font-size="14" font-weight="700" fill="#F5EFE6" letter-spacing="2">.TEAM SIDE (BA)</text>
  <rect x="1540" y="120" width="220" height="36" rx="4" fill="#0A0A0A"/>
  <text x="1650" y="144" text-anchor="middle" font-size="14" font-weight="700" fill="#F5EFE6" letter-spacing="2">.COM SIDE (PROSPECT)</text>
  <text x="40" y="200" font-size="14" font-weight="700" fill="#C9A84C" letter-spacing="3">PHASE 1 — KEVIN CONTROLS THE GATE</text>
  <line x1="40" y1="212" x2="1760" y2="212" stroke="#C9A84C" stroke-width="1" opacity="0.4"/>
  <g><rect x="60" y="240" width="320" height="120" rx="8" fill="#FFFFFF" stroke="#C9A84C" stroke-width="2"/>
    <text x="220" y="270" text-anchor="middle" font-size="12" font-weight="700" fill="#C9A84C" letter-spacing="2">ADMIN DASHBOARD</text>
    <text x="220" y="300" text-anchor="middle" font-size="18" font-weight="700" fill="#0A0A0A">Kevin generates</text>
    <text x="220" y="324" text-anchor="middle" font-size="18" font-weight="700" fill="#0A0A0A">an access code</text>
    <text x="220" y="348" text-anchor="middle" font-size="13" fill="#555555">e.g. TM-07 for Paul</text></g>
  <line x1="220" y1="360" x2="220" y2="410" stroke="#0A0A0A" stroke-width="2" marker-end="url(#arrow)"/>
  <g><rect x="60" y="420" width="320" height="120" rx="8" fill="#0A0A0A"/>
    <text x="220" y="450" text-anchor="middle" font-size="12" font-weight="700" fill="#C9A84C" letter-spacing="2">CODE ASSIGNED</text>
    <text x="220" y="480" text-anchor="middle" font-size="18" font-weight="700" fill="#F5EFE6">Tied to sponsor BA</text>
    <text x="220" y="504" text-anchor="middle" font-size="18" font-weight="700" fill="#F5EFE6">forever after first use</text>
    <text x="220" y="528" text-anchor="middle" font-size="13" fill="#F5EFE6" opacity="0.7">Paul holds TM-07 for life</text></g>
  <text x="40" y="610" font-size="14" font-weight="700" fill="#C9A84C" letter-spacing="3">PHASE 2 — SPONSOR ENROLLS NEW BA INTO THREE INTERNATIONAL (OFF-APP)</text>
  <line x1="40" y1="622" x2="1760" y2="622" stroke="#C9A84C" stroke-width="1" opacity="0.4"/>
  <g><rect x="60" y="650" width="320" height="130" rx="8" fill="#FFFFFF" stroke="#0A0A0A" stroke-width="2"/>
    <text x="220" y="680" text-anchor="middle" font-size="12" font-weight="700" fill="#0A0A0A" letter-spacing="2">OFF-APP · THREE INTERNATIONAL</text>
    <text x="220" y="708" text-anchor="middle" font-size="16" font-weight="700" fill="#0A0A0A">Sponsor walks new BA</text>
    <text x="220" y="730" text-anchor="middle" font-size="16" font-weight="700" fill="#0A0A0A">into THREE's enrollment</text>
    <text x="220" y="754" text-anchor="middle" font-size="12" fill="#555555">BA-to-BA, off our app</text>
    <text x="220" y="770" text-anchor="middle" font-size="11" fill="#555555" font-style="italic">(this is how THREE's own genealogy is set)</text></g>
  <line x1="220" y1="780" x2="220" y2="830" stroke="#0A0A0A" stroke-width="2" marker-end="url(#arrow)"/>
  <g><rect x="60" y="840" width="320" height="100" rx="8" fill="#FFFFFF" stroke="#0A0A0A" stroke-width="2"/>
    <text x="220" y="868" text-anchor="middle" font-size="12" font-weight="700" fill="#0A0A0A" letter-spacing="2">SPONSOR SHARES CODE</text>
    <text x="220" y="896" text-anchor="middle" font-size="16" font-weight="700" fill="#0A0A0A">Paul gives TM-07</text>
    <text x="220" y="918" text-anchor="middle" font-size="16" font-weight="700" fill="#0A0A0A">to the new BA</text></g>
  <text x="40" y="990" font-size="14" font-weight="700" fill="#C9A84C" letter-spacing="3">PHASE 3 — NEW BA SIGNS UP ON .TEAM</text>
  <line x1="40" y1="1002" x2="1760" y2="1002" stroke="#C9A84C" stroke-width="1" opacity="0.4"/>
  <g><rect x="60" y="1030" width="320" height="180" rx="8" fill="#0A0A0A"/>
    <text x="220" y="1058" text-anchor="middle" font-size="12" font-weight="700" fill="#C9A84C" letter-spacing="2">SIGNUP PAGE · /register</text>
    <text x="220" y="1086" text-anchor="middle" font-size="16" font-weight="700" fill="#F5EFE6">New BA enters:</text>
    <text x="220" y="1110" text-anchor="middle" font-size="13" fill="#F5EFE6">Access code (TM-07)</text>
    <text x="220" y="1128" text-anchor="middle" font-size="13" fill="#F5EFE6">First &amp; last name</text>
    <text x="220" y="1146" text-anchor="middle" font-size="13" fill="#F5EFE6">Email · phone · password</text>
    <text x="220" y="1164" text-anchor="middle" font-size="13" fill="#F5EFE6">THREE username + ID</text>
    <text x="220" y="1196" text-anchor="middle" font-size="11" fill="#C9A84C" font-style="italic">Code locks sponsor at this moment</text></g>
  <line x1="220" y1="1210" x2="220" y2="1260" stroke="#0A0A0A" stroke-width="2" marker-end="url(#arrow)"/>
  <g><rect x="60" y="1270" width="320" height="100" rx="8" fill="#FFFFFF" stroke="#0A0A0A" stroke-width="2"/>
    <text x="220" y="1298" text-anchor="middle" font-size="12" font-weight="700" fill="#0A0A0A" letter-spacing="2">WELCOME</text>
    <text x="220" y="1326" text-anchor="middle" font-size="16" font-weight="700" fill="#0A0A0A">Welcome to the team</text>
    <text x="220" y="1350" text-anchor="middle" font-size="12" fill="#555555">First surface after signup</text></g>
  <line x1="220" y1="1370" x2="220" y2="1410" stroke="#0A0A0A" stroke-width="2" marker-end="url(#arrow)"/>
  <g><rect x="60" y="1420" width="320" height="100" rx="8" fill="#2DD4BF" opacity="0.15" stroke="#2DD4BF" stroke-width="2"/>
    <text x="220" y="1448" text-anchor="middle" font-size="12" font-weight="700" fill="#0A0A0A" letter-spacing="2">MICHAEL · VOICE AGENT</text>
    <text x="220" y="1476" text-anchor="middle" font-size="16" font-weight="700" fill="#0A0A0A">Outbound call interview</text>
    <text x="220" y="1500" text-anchor="middle" font-size="12" fill="#555555">Why · goals · time · sponsor needs</text></g>
  <line x1="220" y1="1520" x2="220" y2="1560" stroke="#0A0A0A" stroke-width="2" marker-end="url(#arrow)"/>
  <g><rect x="60" y="1570" width="320" height="160" rx="8" fill="#C9A84C" opacity="0.15" stroke="#C9A84C" stroke-width="2"/>
    <text x="220" y="1598" text-anchor="middle" font-size="12" font-weight="700" fill="#0A0A0A" letter-spacing="2">FAST START · FIRST 72H</text>
    <text x="220" y="1626" text-anchor="middle" font-size="14" fill="#0A0A0A">Comp plan training</text>
    <text x="220" y="1646" text-anchor="middle" font-size="14" fill="#0A0A0A">Binary placement</text>
    <text x="220" y="1666" text-anchor="middle" font-size="14" fill="#0A0A0A">GLP-THREE &amp; products</text>
    <text x="220" y="1686" text-anchor="middle" font-size="14" fill="#0A0A0A">Initial prospect list</text>
    <text x="220" y="1706" text-anchor="middle" font-size="14" fill="#0A0A0A">Identify first 2 candidates</text></g>
  <line x1="220" y1="1730" x2="220" y2="1770" stroke="#0A0A0A" stroke-width="2" marker-end="url(#arrow)"/>
  <g><rect x="60" y="1780" width="320" height="100" rx="8" fill="#FFFFFF" stroke="#0A0A0A" stroke-width="2"/>
    <text x="220" y="1808" text-anchor="middle" font-size="12" font-weight="700" fill="#0A0A0A" letter-spacing="2">10-STEP ORIENTATION</text>
    <text x="220" y="1836" text-anchor="middle" font-size="16" font-weight="700" fill="#0A0A0A">Live with Kevin or Paul</text>
    <text x="220" y="1860" text-anchor="middle" font-size="12" fill="#555555">Zoom, scheduled from .team</text></g>
  <line x1="220" y1="1880" x2="220" y2="1920" stroke="#0A0A0A" stroke-width="2" marker-end="url(#arrow)"/>
  <g><rect x="60" y="1930" width="320" height="120" rx="8" fill="#C9A84C" opacity="0.25" stroke="#C9A84C" stroke-width="2.5"/>
    <text x="220" y="1958" text-anchor="middle" font-size="12" font-weight="700" fill="#0A0A0A" letter-spacing="2">INVITATION GENERATOR</text>
    <text x="220" y="1986" text-anchor="middle" font-size="16" font-weight="700" fill="#0A0A0A">New BA invites their</text>
    <text x="220" y="2008" text-anchor="middle" font-size="16" font-weight="700" fill="#0A0A0A">first 2 prospects</text>
    <text x="220" y="2034" text-anchor="middle" font-size="11" fill="#555555" font-style="italic">After speaking with them first</text></g>
  <g>
    <text x="900" y="220" text-anchor="middle" font-size="13" font-weight="700" fill="#C9A84C" letter-spacing="3">ACCESS CODE GENEALOGY</text>
    <text x="900" y="240" text-anchor="middle" font-size="11" fill="#555555" font-style="italic">Independent confirmation of who sponsored whom</text>
    <rect x="800" y="270" width="200" height="80" rx="8" fill="#0A0A0A"/>
    <text x="900" y="298" text-anchor="middle" font-size="13" font-weight="700" fill="#C9A84C">TM-01</text>
    <text x="900" y="324" text-anchor="middle" font-size="15" font-weight="700" fill="#F5EFE6">KEVIN</text>
    <text x="900" y="342" text-anchor="middle" font-size="11" fill="#F5EFE6" opacity="0.6">Root of the tree</text>
    <line x1="900" y1="350" x2="900" y2="380" stroke="#C9A84C" stroke-width="2"/>
    <line x1="700" y1="380" x2="1100" y2="380" stroke="#C9A84C" stroke-width="2"/>
    <line x1="700" y1="380" x2="700" y2="410" stroke="#C9A84C" stroke-width="2"/>
    <line x1="900" y1="380" x2="900" y2="410" stroke="#C9A84C" stroke-width="2"/>
    <line x1="1100" y1="380" x2="1100" y2="410" stroke="#C9A84C" stroke-width="2"/>
    <rect x="610" y="410" width="180" height="60" rx="6" fill="#FFFFFF" stroke="#C9A84C" stroke-width="2"/>
    <text x="700" y="436" text-anchor="middle" font-size="12" font-weight="700" fill="#C9A84C">TM-02</text>
    <text x="700" y="456" text-anchor="middle" font-size="13" font-weight="700" fill="#0A0A0A">BA · direct of Kevin</text>
    <rect x="810" y="410" width="180" height="60" rx="6" fill="#FFFFFF" stroke="#C9A84C" stroke-width="2"/>
    <text x="900" y="436" text-anchor="middle" font-size="12" font-weight="700" fill="#C9A84C">TM-03</text>
    <text x="900" y="456" text-anchor="middle" font-size="13" font-weight="700" fill="#0A0A0A">BA · direct of Kevin</text>
    <rect x="1010" y="410" width="180" height="60" rx="6" fill="#FFFFFF" stroke="#C9A84C" stroke-width="2"/>
    <text x="1100" y="436" text-anchor="middle" font-size="12" font-weight="700" fill="#C9A84C">TM-04</text>
    <text x="1100" y="456" text-anchor="middle" font-size="13" font-weight="700" fill="#0A0A0A">BA · direct of Kevin</text>
    <line x1="700" y1="470" x2="700" y2="510" stroke="#C9A84C" stroke-width="2"/>
    <line x1="700" y1="510" x2="1100" y2="510" stroke="#C9A84C" stroke-width="2"/>
    <line x1="700" y1="510" x2="700" y2="540" stroke="#C9A84C" stroke-width="2"/>
    <line x1="900" y1="510" x2="900" y2="540" stroke="#C9A84C" stroke-width="2"/>
    <line x1="1100" y1="510" x2="1100" y2="540" stroke="#C9A84C" stroke-width="2"/>
    <rect x="610" y="540" width="180" height="60" rx="6" fill="#FFFFFF" stroke="#C9A84C" stroke-width="1"/>
    <text x="700" y="566" text-anchor="middle" font-size="12" font-weight="700" fill="#C9A84C">TM-05</text>
    <text x="700" y="586" text-anchor="middle" font-size="12" fill="#555555">downline of TM-02</text>
    <rect x="810" y="540" width="180" height="60" rx="6" fill="#FFFFFF" stroke="#C9A84C" stroke-width="1"/>
    <text x="900" y="566" text-anchor="middle" font-size="12" font-weight="700" fill="#C9A84C">TM-06</text>
    <text x="900" y="586" text-anchor="middle" font-size="12" fill="#555555">downline of TM-03</text>
    <rect x="1010" y="540" width="180" height="60" rx="6" fill="#C9A84C"/>
    <text x="1100" y="566" text-anchor="middle" font-size="12" font-weight="700" fill="#0A0A0A">TM-07 · PAUL</text>
    <text x="1100" y="586" text-anchor="middle" font-size="11" font-weight="700" fill="#0A0A0A">our example</text>
    <line x1="1100" y1="600" x2="1100" y2="630" stroke="#C9A84C" stroke-width="2"/>
    <line x1="1000" y1="630" x2="1200" y2="630" stroke="#C9A84C" stroke-width="2"/>
    <line x1="1000" y1="630" x2="1000" y2="660" stroke="#C9A84C" stroke-width="2"/>
    <line x1="1200" y1="630" x2="1200" y2="660" stroke="#C9A84C" stroke-width="2"/>
    <rect x="920" y="660" width="160" height="50" rx="6" fill="#FFFFFF" stroke="#0A0A0A" stroke-width="2"/>
    <text x="1000" y="685" text-anchor="middle" font-size="11" font-weight="700" fill="#0A0A0A">New BA</text>
    <text x="1000" y="702" text-anchor="middle" font-size="10" fill="#555555">uses TM-07 to sign up</text>
    <rect x="1120" y="660" width="160" height="50" rx="6" fill="#FFFFFF" stroke="#0A0A0A" stroke-width="2" stroke-dasharray="3,3"/>
    <text x="1200" y="685" text-anchor="middle" font-size="11" font-weight="700" fill="#555555">Future BA</text>
    <text x="1200" y="702" text-anchor="middle" font-size="10" fill="#555555">also TM-07</text>
    <rect x="620" y="780" width="560" height="180" rx="8" fill="#F5EFE6" stroke="#0A0A0A" stroke-width="1.5"/>
    <text x="900" y="810" text-anchor="middle" font-size="13" font-weight="700" fill="#0A0A0A" letter-spacing="2">THE GENEALOGY PRINCIPLE</text>
    <line x1="780" y1="822" x2="1020" y2="822" stroke="#C9A84C" stroke-width="2"/>
    <text x="640" y="850" font-size="13" fill="#0A0A0A">Every code traces back to Kevin (TM-01).</text>
    <text x="640" y="876" font-size="13" fill="#0A0A0A">Every BA carries the code of who sponsored them.</text>
    <text x="640" y="902" font-size="13" fill="#0A0A0A">An independent record from THREE's own tree.</text>
    <text x="640" y="935" font-size="12" font-style="italic" fill="#555555">If anything ever goes wrong with THREE's data,</text>
    <text x="640" y="952" font-size="12" font-style="italic" fill="#555555">the Team Magnificent record confirms the chain.</text>
  </g>
  <text x="1760" y="990" text-anchor="end" font-size="14" font-weight="700" fill="#2DD4BF" letter-spacing="3">PHASE 4 — NEW BA INVITES A PROSPECT</text>
  <g><rect x="1420" y="1030" width="320" height="100" rx="8" fill="#FFFFFF" stroke="#2DD4BF" stroke-width="2"/>
    <text x="1580" y="1058" text-anchor="middle" font-size="12" font-weight="700" fill="#2DD4BF" letter-spacing="2">STEP 1 · BEFORE THE LINK</text>
    <text x="1580" y="1086" text-anchor="middle" font-size="16" font-weight="700" fill="#0A0A0A">Real human conversation</text>
    <text x="1580" y="1108" text-anchor="middle" font-size="12" fill="#555555">SMS or scripted call · warm contact</text></g>
  <line x1="1580" y1="1130" x2="1580" y2="1170" stroke="#2DD4BF" stroke-width="2" marker-end="url(#arrowTeal)"/>
  <g><rect x="1420" y="1180" width="320" height="100" rx="8" fill="#FFFFFF" stroke="#2DD4BF" stroke-width="2"/>
    <text x="1580" y="1208" text-anchor="middle" font-size="12" font-weight="700" fill="#2DD4BF" letter-spacing="2">STEP 2 · GENERATE LINK</text>
    <text x="1580" y="1236" text-anchor="middle" font-size="16" font-weight="700" fill="#0A0A0A">BA mints personalized link</text>
    <text x="1580" y="1258" text-anchor="middle" font-size="12" fill="#555555">From the invitation generator on .team</text></g>
  <line x1="1580" y1="1280" x2="1580" y2="1320" stroke="#2DD4BF" stroke-width="2" marker-end="url(#arrowTeal)"/>
  <g><rect x="1420" y="1330" width="320" height="160" rx="8" fill="#2DD4BF" opacity="0.15" stroke="#2DD4BF" stroke-width="2"/>
    <text x="1580" y="1358" text-anchor="middle" font-size="12" font-weight="700" fill="#0A0A0A" letter-spacing="2">PRESENTATION PAGE</text>
    <text x="1580" y="1386" text-anchor="middle" font-size="16" font-weight="700" fill="#0A0A0A">Dr. Dan video (17 min)</text>
    <text x="1580" y="1410" text-anchor="middle" font-size="13" fill="#0A0A0A">Market opportunity</text>
    <text x="1580" y="1430" text-anchor="middle" font-size="13" fill="#0A0A0A">Product detail</text>
    <text x="1580" y="1450" text-anchor="middle" font-size="13" fill="#0A0A0A">System &amp; 2-in-72</text>
    <text x="1580" y="1474" text-anchor="middle" font-size="11" fill="#555555" font-style="italic">Product first · opportunity second</text></g>
  <line x1="1580" y1="1490" x2="1580" y2="1530" stroke="#2DD4BF" stroke-width="2" marker-end="url(#arrowTeal)"/>
  <g><rect x="1420" y="1540" width="320" height="80" rx="8" fill="#0A0A0A"/>
    <text x="1580" y="1568" text-anchor="middle" font-size="12" font-weight="700" fill="#2DD4BF" letter-spacing="2">EVENT FIRES</text>
    <text x="1580" y="1596" text-anchor="middle" font-size="16" font-weight="700" fill="#F5EFE6">video_complete</text></g>
  <line x1="1580" y1="1620" x2="1580" y2="1660" stroke="#2DD4BF" stroke-width="2" marker-end="url(#arrowTeal)"/>
  <g><rect x="1420" y="1670" width="320" height="100" rx="8" fill="#C9A84C" opacity="0.2" stroke="#C9A84C" stroke-width="2"/>
    <text x="1580" y="1698" text-anchor="middle" font-size="12" font-weight="700" fill="#0A0A0A" letter-spacing="2">PLACEMENT</text>
    <text x="1580" y="1726" text-anchor="middle" font-size="16" font-weight="700" fill="#0A0A0A">Holding tank · position #N</text>
    <text x="1580" y="1748" text-anchor="middle" font-size="12" fill="#555555">Team-wide pool · monotonic · immutable</text></g>
  <line x1="1580" y1="1770" x2="1580" y2="1810" stroke="#2DD4BF" stroke-width="2" marker-end="url(#arrowTeal)"/>
  <g><rect x="1420" y="1820" width="320" height="120" rx="8" fill="#FFFFFF" stroke="#0A0A0A" stroke-width="2"/>
    <text x="1580" y="1848" text-anchor="middle" font-size="12" font-weight="700" fill="#0A0A0A" letter-spacing="2">DASHBOARD · 6 SECTIONS</text>
    <text x="1580" y="1876" text-anchor="middle" font-size="14" font-weight="700" fill="#0A0A0A">Arrival · Opportunity · Mechanic</text>
    <text x="1580" y="1896" text-anchor="middle" font-size="14" font-weight="700" fill="#0A0A0A">Live Place · TM Advantage</text>
    <text x="1580" y="1916" text-anchor="middle" font-size="14" font-weight="700" fill="#0A0A0A">Your Next Move</text></g>
  <line x1="1580" y1="1940" x2="1580" y2="1980" stroke="#2DD4BF" stroke-width="2" marker-end="url(#arrowTeal)"/>
  <g><rect x="1420" y="1990" width="320" height="100" rx="8" fill="#FFFFFF" stroke="#2DD4BF" stroke-width="2"/>
    <text x="1580" y="2018" text-anchor="middle" font-size="12" font-weight="700" fill="#2DD4BF" letter-spacing="2">PROSPECT DECIDES</text>
    <text x="1580" y="2042" text-anchor="middle" font-size="14" fill="#0A0A0A">Callback from BA</text>
    <text x="1580" y="2062" text-anchor="middle" font-size="14" fill="#0A0A0A">or webinar seat (Tue 7pm PT)</text></g>
  <g><rect x="620" y="2160" width="560" height="180" rx="8" fill="#0A0A0A"/>
    <text x="900" y="2192" text-anchor="middle" font-size="14" font-weight="700" fill="#C9A84C" letter-spacing="3">THE CYCLE COMPLETES</text>
    <line x1="800" y1="2204" x2="1000" y2="2204" stroke="#C9A84C" stroke-width="2"/>
    <text x="900" y="2240" text-anchor="middle" font-size="15" fill="#F5EFE6">Prospect enrolls in THREE through their BA.</text>
    <text x="900" y="2266" text-anchor="middle" font-size="15" fill="#F5EFE6">BA requests their own access code from Kevin.</text>
    <text x="900" y="2292" text-anchor="middle" font-size="15" fill="#F5EFE6">Kevin issues TM-NN. The new BA's sponsorship begins.</text>
    <text x="900" y="2326" text-anchor="middle" font-size="13" font-weight="700" fill="#C9A84C" letter-spacing="2">PHASE 1 STARTS AGAIN · ONE LEVEL DOWN</text></g>
  <path d="M 620 2250 Q 250 2250 130 2000 Q 50 1700 50 1000 Q 50 500 100 320" stroke="#C9A84C" stroke-width="2.5" fill="none" stroke-dasharray="6,6" marker-end="url(#arrowGold)"/>
  <text x="80" y="1500" font-size="13" font-weight="700" fill="#C9A84C" transform="rotate(-90 80 1500)" letter-spacing="3">EVERY NEW BA STARTS A NEW CYCLE</text>
</svg>`;

async function render(svgString, outPath, width, height) {
  const buf = Buffer.from(svgString, 'utf8');
  await sharp(buf, { density: 150 })
    .resize(width, height, { fit: 'fill', background: { r: 255, g: 255, b: 255 } })
    .png()
    .toFile(outPath);
  const stat = fs.statSync(outPath);
  console.log('wrote ' + outPath + ' (' + stat.size + ' bytes)');
}

(async () => {
  const flowOut = path.join(__dirname, 'flow.png');
  await render(FLOW_SVG, flowOut, 1800, 2400);
})();
