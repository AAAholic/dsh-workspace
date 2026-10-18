import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inlineWorkspaceGeometry, compactWorkspaceBudget, workspacePetPlacement } from '../lib/client/layout.mjs';

test('inline workspace reserves a real column without sacrificing 560px reading space',()=>{
  assert.deepEqual(inlineWorkspaceGeometry(1160),{width:244,compact:false,readingWidth:884});
  assert.deepEqual(inlineWorkspaceGeometry(1000),{width:230,compact:false,readingWidth:738});
  assert.deepEqual(inlineWorkspaceGeometry(822),{width:230,compact:false,readingWidth:560});
  assert.deepEqual(inlineWorkspaceGeometry(1310),{width:258,compact:false,readingWidth:1020});
});

test('compact height budget preserves the real composer and 120px of readable messages',()=>{
  assert.deepEqual(compactWorkspaceBudget({height:900,headerHeight:76,composerHeight:192}),{maxExpandedHeight:340,canExpand:true});
  assert.deepEqual(compactWorkspaceBudget({height:500,headerHeight:50,composerHeight:192}),{maxExpandedHeight:122,canExpand:true});
  assert.deepEqual(compactWorkspaceBudget({height:500,headerHeight:50,composerHeight:324}),{maxExpandedHeight:0,canExpand:false});
  assert.deepEqual(compactWorkspaceBudget({height:350,headerHeight:76,composerHeight:192}),{maxExpandedHeight:0,canExpand:false});
});

test('pet placement rejects narrow lanes and real input/forecast collisions',()=>{
  const lane={left:1000,right:1240,top:300,bottom:700};
  const body={left:216,right:980,top:50,bottom:724};
  assert.deepEqual(workspacePetPlacement(lane,[body]),{left:1096,right:1240,top:556,bottom:700});
  assert.equal(workspacePetPlacement({...lane,left:1100},[body]),null);
  const forecast={left:1000,right:1280,top:540,bottom:724};
  assert.deepEqual(workspacePetPlacement(lane,[body,forecast]),{left:1096,right:1240,top:388,bottom:532});
  assert.equal(workspacePetPlacement(lane,[body,{left:1000,right:1280,top:300,bottom:724}]),null);
});

test('very narrow conversation uses an inline compact entry, never native fullscreen',()=>{
  assert.deepEqual(inlineWorkspaceGeometry(821),{width:230,compact:true,readingWidth:821});
  assert.deepEqual(inlineWorkspaceGeometry(720),{width:230,compact:true,readingWidth:720});
  assert.deepEqual(inlineWorkspaceGeometry(400),{width:230,compact:true,readingWidth:400});
});
