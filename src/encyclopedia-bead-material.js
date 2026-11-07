// The graph and physical comparison deliberately use the same bead material.
// This sheet is appended after each view's structural CSS, leaving sizes,
// topology and interaction affordances under their respective owners.
const STYLE_ID='molecule-craft-shared-bead-material';
const STYLE=`
.graph-node{border:1px solid #c5eeec38;background:radial-gradient(circle at 28% 19%,#76b5ba 0,#387a88 22%,#195061 58%,#091d2e 100%);box-shadow:inset 3px 4px 7px #e6fff321,inset -8px -11px 14px #020e1db0,0 5px 10px #0008}
.graph-node.registered,.graph-node.focus.registered{border:1px solid #b4e9df3c;background:radial-gradient(circle at 28% 19%,#81bdb3 0,#3a877c 23%,#1d5856 60%,#0a242c 100%);box-shadow:inset 3px 4px 8px #e4fff12b,inset -8px -11px 14px #020f19ab,0 6px 14px #0008}
.graph-node.known,.graph-node.focus.known{border:1px solid #aedbd737;background:radial-gradient(circle at 29% 19%,#7ca7ac 0,#3d777d 24%,#234852 62%,#0b1d2c 100%);box-shadow:inset 3px 4px 8px #efffff22,inset -8px -11px 15px #020e1ab0,0 6px 14px #0008}
.graph-node.unknown{border:1px solid #b3d1e234;background:radial-gradient(circle at 28% 20%,#6a91a8 0,#344f6b 31%,#152b43 66%,#071729 100%);box-shadow:inset 3px 4px 7px #d6ebff1c,inset -8px -11px 14px #010b1aab,0 5px 10px #0008}
.graph-node.known:after{display:none}
.graph-node.unknown:before{border:1px solid #9ebed257;background:radial-gradient(circle at 30% 25%,#d8f6ff28,#0a243900);opacity:.7}
.graph-node.focus{border-width:1px;box-shadow:inset 4px 5px 9px #e6fff330,inset -12px -15px 20px #020e1dc0,0 0 15px #64cfc727,0 9px 18px #0009}
.graph-node.focus.registered{box-shadow:inset 4px 5px 9px #e6fff338,inset -12px -15px 20px #020e1dc0,0 0 15px #64cfc727,0 9px 18px #0009}
`;

export function ensureMoleculeBeadStyles(document){
  if(!document?.head)return;
  let style=document.getElementById(STYLE_ID);
  if(!style){style=document.createElement('style');style.id=STYLE_ID;style.textContent=STYLE;}
  // Keep the shared material last even if the user switches graph modes.
  document.head.append(style);
}
