import React, { useRef, useEffect, useState } from "react";
import { Stage, Layer, Rect as KonvaRect, Ellipse as KonvaEllipse, Line as KonvaLine, Text as KonvaText, Transformer as KonvaTransformer } from "react-konva";
import T, { alpha } from "@/theme";
import { CDR_PALETTE, CDR_PAL_TABS, CDR_SWATCHES } from "@/constants/cdrPalette";

function CdrCanvas({shapes,onChange,activeColor,activeOpacity}){
  const containerRef=useRef(null);
  const stageRef=useRef(null);
  const trRef=useRef(null);
  const [size,setSize]=useState({w:800,h:500});
  const [tool,setTool]=useState("select");
  const [selectedId,setSelectedId]=useState(null);
  const [isDrawing,setIsDrawing]=useState(false);
  const [drawStart,setDrawStart]=useState(null);
  const [preview,setPreview]=useState(null);
  const [polyPts,setPolyPts]=useState([]);
  const [textInput,setTextInput]=useState(null);
  const [textVal,setTextVal]=useState("");
  const [paletteOpen,setPaletteOpen]=useState(true);
  const [paletteTab,setPaletteTab]=useState("zone");
  const [labelEditId,setLabelEditId]=useState(null);
  const [labelVal,setLabelVal]=useState("");
  const [labelPos,setLabelPos]=useState({x:0,y:0});

  useEffect(()=>{
    const el=containerRef.current;if(!el)return;
    const ro=new ResizeObserver(entries=>{
      const{width,height}=entries[0].contentRect;
      if(width>10&&height>10)setSize({w:Math.floor(width),h:Math.floor(height)});
    });
    ro.observe(el);return()=>ro.disconnect();
  },[]);

  useEffect(()=>{
    if(!trRef.current||!stageRef.current)return;
    const node=selectedId?stageRef.current.findOne("#"+selectedId):null;
    trRef.current.nodes(node?[node]:[]);
    trRef.current.getLayer()?.batchDraw();
  },[selectedId,shapes]);

  const newId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const fillC=activeColor+Math.round((activeOpacity??0.5)*255).toString(16).padStart(2,"0");
  const getStagePt=e=>{const st=stageRef.current;st.setPointersPositions(e);return st.getPointerPosition();};

  // ── Stamp a palette preset ──────────────────────────────────────────────────
  const stampShape=(preset)=>{
    const off=(shapes.length%6)*18;
    const cx=size.w/2-((preset.w||preset.rx*2||60)/2)+off;
    const cy=size.h/2-((preset.h||preset.ry*2||60)/2)+off;
    let shape;
    if(preset.type==="rect")
      shape={id:newId(),type:"rect",x:cx,y:cy,width:preset.w,height:preset.h,
             fill:preset.fill,stroke:preset.stroke,strokeWidth:2,label:preset.label,cornerRadius:preset.cr||0};
    else if(preset.type==="ellipse")
      shape={id:newId(),type:"ellipse",x:cx+preset.rx,y:cy+preset.ry,radiusX:preset.rx,radiusY:preset.ry,
             fill:preset.fill,stroke:preset.stroke,strokeWidth:2,label:preset.label};
    if(shape){ onChange([...shapes,shape]); setSelectedId(shape.id); setTool("select"); }
  };

  // ── Z-order ─────────────────────────────────────────────────────────────────
  const moveZ=(id,dir)=>{
    const idx=shapes.findIndex(s=>s.id===id);
    const ns=[...shapes];
    const target=idx+dir;
    if(target<0||target>=ns.length)return;
    [ns[idx],ns[target]]=[ns[target],ns[idx]];
    onChange(ns);
  };

  // ── Free-draw handlers ───────────────────────────────────────────────────────
  const onMouseDown=e=>{
    if(tool==="select"){if(e.target===stageRef.current)setSelectedId(null);return;}
    const pos=getStagePt(e.evt);
    if(tool==="text"){setTextInput(pos);return;}
    if(tool==="polygon"){setPolyPts(p=>[...p,pos.x,pos.y]);return;}
    setDrawStart(pos);setIsDrawing(true);
    const base={id:null,fill:fillC,stroke:activeColor,strokeWidth:2};
    if(tool==="rect")setPreview({...base,type:"rect",x:pos.x,y:pos.y,width:0,height:0,cornerRadius:0});
    if(tool==="ellipse")setPreview({...base,type:"ellipse",x:pos.x,y:pos.y,radiusX:0,radiusY:0});
    if(tool==="line")setPreview({...base,type:"line",points:[pos.x,pos.y,pos.x,pos.y]});
  };
  const onMouseMove=e=>{
    if(!isDrawing||!drawStart)return;
    const pos=getStagePt(e.evt);
    if(tool==="rect")setPreview(p=>({...p,x:Math.min(drawStart.x,pos.x),y:Math.min(drawStart.y,pos.y),width:Math.abs(pos.x-drawStart.x),height:Math.abs(pos.y-drawStart.y)}));
    if(tool==="ellipse")setPreview(p=>({...p,x:(drawStart.x+pos.x)/2,y:(drawStart.y+pos.y)/2,radiusX:Math.abs(pos.x-drawStart.x)/2,radiusY:Math.abs(pos.y-drawStart.y)/2}));
    if(tool==="line")setPreview(p=>({...p,points:[drawStart.x,drawStart.y,pos.x,pos.y]}));
  };
  const onMouseUp=()=>{
    if(!isDrawing||!preview){setIsDrawing(false);return;}
    setIsDrawing(false);
    const ok=(preview.type==="rect"&&preview.width>4&&preview.height>4)||
             (preview.type==="ellipse"&&preview.radiusX>4&&preview.radiusY>4)||
             (preview.type==="line"&&Math.hypot(preview.points[2]-preview.points[0],preview.points[3]-preview.points[1])>4);
    if(ok)onChange([...shapes,{...preview,id:newId()}]);
    setPreview(null);setDrawStart(null);
  };
  const onDblClick=e=>{
    if(tool==="polygon"&&polyPts.length>=6){
      onChange([...shapes,{id:newId(),type:"polygon",points:[...polyPts],fill:fillC,stroke:activeColor,strokeWidth:2,closed:true}]);
      setPolyPts([]);return;
    }
    // Label edit on double-click in select mode
    if(tool==="select"&&selectedId){
      const sh=shapes.find(s=>s.id===selectedId);
      if(!sh||sh.type==="line"||sh.type==="text")return;
      const stage=stageRef.current;
      const node=stage.findOne("#"+selectedId);
      if(!node)return;
      const rect=containerRef.current.getBoundingClientRect();
      const pos=node.getClientRect({relativeTo:stage});
      setLabelEditId(selectedId);
      setLabelVal(sh.label||"");
      setLabelPos({x:pos.x+pos.width/2,y:pos.y+pos.height/2});
    }
  };
  const commitText=()=>{
    if(!textVal.trim()||!textInput)return;
    onChange([...shapes,{id:newId(),type:"text",x:textInput.x,y:textInput.y,text:textVal,fontSize:14,fill:activeColor}]);
    setTextInput(null);setTextVal("");
  };
  const commitLabel=()=>{
    if(labelEditId) updShape(labelEditId,{label:labelVal});
    setLabelEditId(null);setLabelVal("");
  };
  const deleteSelected=()=>{ if(!selectedId)return; onChange(shapes.filter(s=>s.id!==selectedId)); setSelectedId(null); };
  const updShape=(id,attrs)=>onChange(shapes.map(s=>s.id===id?{...s,...attrs}:s));

  const sp=s=>({
    id:s.id,key:s.id,
    draggable:tool==="select",
    onClick:()=>{if(tool==="select")setSelectedId(s.id);},
    onDragEnd:e=>updShape(s.id,{x:e.target.x(),y:e.target.y()}),
    onTransformEnd:e=>{
      const n=e.target;
      if(s.type==="rect")updShape(s.id,{x:n.x(),y:n.y(),width:Math.max(5,n.width()*n.scaleX()),height:Math.max(5,n.height()*n.scaleY()),rotation:n.rotation()});
      if(s.type==="ellipse")updShape(s.id,{x:n.x(),y:n.y(),radiusX:Math.max(5,n.radiusX()*n.scaleX()),radiusY:Math.max(5,n.radiusY()*n.scaleY()),rotation:n.rotation()});
      n.scaleX(1);n.scaleY(1);
    },
  });

  const DRAW_TOOLS=[["select","↖","Seleziona"],["rect","▭","Rettangolo"],["ellipse","⬭","Ellisse"],["polygon","⬡","Poligono"],["line","╲","Linea"],["text","T","Testo"]];
  const GRID=40;
  const gridLines=[];
  for(let x=0;x<=size.w;x+=GRID)gridLines.push(<KonvaLine key={"gv"+x} points={[x,0,x,size.h]} stroke="#ffffff07" strokeWidth={1} listening={false}/>);
  for(let y=0;y<=size.h;y+=GRID)gridLines.push(<KonvaLine key={"gh"+y} points={[0,y,size.w,y]} stroke="#ffffff07" strokeWidth={1} listening={false}/>);

  const selectedShape=shapes.find(s=>s.id===selectedId);
  const btnBase={padding:"4px 9px",borderRadius:6,cursor:"pointer",fontSize:11,fontFamily:T.font,border:`1px solid ${T.border}`,background:"transparent",color:T.textSub};
  const btnActive={...btnBase,border:`1px solid ${alpha(T.blue,40)}`,background:T.navActive,color:T.blue,fontWeight:700};

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* ── MAIN TOOLBAR ── */}
      <div style={{display:"flex",gap:4,padding:"7px 10px",borderBottom:`1px solid ${T.border}`,background:T.card,flexShrink:0,flexWrap:"wrap",alignItems:"center"}}>
        {/* Draw tools */}
        {DRAW_TOOLS.map(([t,icon,lbl])=>(
          <button key={t} title={lbl} onClick={()=>{setTool(t);setPolyPts([]);setTextInput(null);setTextVal("");}}
            style={tool===t?btnActive:btnBase}>
            {icon} {lbl}
          </button>
        ))}
        <div style={{width:1,height:18,background:T.border,margin:"0 3px"}}/>
        {/* Palette toggle */}
        <button onClick={()=>setPaletteOpen(v=>!v)}
          style={paletteOpen?{...btnBase,border:`1px solid ${alpha(T.green,40)}`,background:"#0a1a0a",color:T.green,fontWeight:700}:btnBase}>
          🏗 Palette {paletteOpen?"▲":"▼"}
        </button>
        {/* Polygon hint */}
        {tool==="polygon"&&<span style={{fontSize:10,color:T.textSub,marginLeft:4}}>{polyPts.length<6?"≥3 click · ":""}Dbl-click per chiudere</span>}

        {/* Selected shape controls */}
        {selectedShape&&(
          <>
            <div style={{width:1,height:18,background:T.border,margin:"0 3px"}}/>
            {/* Z-order */}
            <button title="Porta avanti" onClick={()=>moveZ(selectedId,1)} style={btnBase}>⬆ Livello</button>
            <button title="Porta indietro" onClick={()=>moveZ(selectedId,-1)} style={btnBase}>⬇ Livello</button>
            <div style={{width:1,height:18,background:T.border,margin:"0 3px"}}/>
            {/* Color swatches */}
            {CDR_SWATCHES.map(c=>(
              <button key={c} title={c} onClick={()=>updShape(selectedId,{stroke:c,fill:c+"22"})}
                style={{width:16,height:16,borderRadius:3,background:c,border:selectedShape.stroke===c?`2px solid #fff`:`1px solid ${c}44`,cursor:"pointer",padding:0,flexShrink:0}}/>
            ))}
            <div style={{width:1,height:18,background:T.border,margin:"0 3px"}}/>
            <button onClick={deleteSelected} style={{...btnBase,border:"1px solid #3a1a1a",background:"#1a0808",color:T.red}}>✕ Elimina</button>
          </>
        )}
        <button onClick={()=>{if(window.confirm("Cancellare tutte le forme?")){onChange([]);setSelectedId(null);}}}
          style={{...btnBase,marginLeft:"auto"}}>🗑 Tutto</button>
      </div>

      {/* ── PALETTE PANEL ── */}
      {paletteOpen&&(
        <div style={{background:"#0b1524",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          {/* Tab bar */}
          <div style={{display:"flex",gap:0,borderBottom:`1px solid ${alpha(T.border,13)}`}}>
            {CDR_PAL_TABS.map(([id,lbl])=>(
              <button key={id} onClick={()=>setPaletteTab(id)}
                style={{padding:"6px 16px",fontSize:11,fontWeight:paletteTab===id?700:400,fontFamily:T.font,cursor:"pointer",border:"none",borderBottom:paletteTab===id?`2px solid ${T.blue}`:"2px solid transparent",background:"transparent",color:paletteTab===id?T.blue:T.textSub,transition:"color 0.1s"}}>
                {lbl}
              </button>
            ))}
          </div>
          {/* Items */}
          <div style={{display:"flex",gap:6,padding:"8px 10px",overflowX:"auto",flexWrap:"wrap"}}>
            {(CDR_PALETTE[paletteTab]||[]).map(preset=>(
              <button key={preset.id} onClick={()=>stampShape(preset)}
                style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"6px 10px",borderRadius:8,cursor:"pointer",fontFamily:T.font,border:`1px solid ${preset.stroke}44`,background:preset.fill,color:preset.stroke,minWidth:72,transition:"all 0.15s",flexShrink:0}}
                onMouseEnter={e=>{e.currentTarget.style.border=`1px solid ${preset.stroke}`;e.currentTarget.style.boxShadow=`0 0 8px ${preset.stroke}44`;}}
                onMouseLeave={e=>{e.currentTarget.style.border=`1px solid ${preset.stroke}44`;e.currentTarget.style.boxShadow="none";}}>
                {/* Shape mini-preview */}
                <div style={{width:preset.type==="ellipse"?24:32,height:preset.type==="ellipse"?30:preset.h>80?30:20,borderRadius:preset.type==="ellipse"?"50%":(preset.cr||0),border:`2px solid ${preset.stroke}`,background:preset.stroke+"22",flexShrink:0}}/>
                <span style={{fontSize:9,textAlign:"center",whiteSpace:"nowrap",maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",fontWeight:600,letterSpacing:0.2}}>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── CANVAS STAGE ── */}
      <div ref={containerRef} style={{flex:1,overflow:"hidden",position:"relative",cursor:tool==="select"?"default":"crosshair"}}>
        <Stage ref={stageRef} width={size.w} height={size.h}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onDblClick={onDblClick}
          style={{background:"#0e1822"}}>
          <Layer>
            {gridLines}
            {shapes.map(s=>{
              const p=sp(s);
              const hasLabel=s.label&&(s.type==="rect"||s.type==="ellipse");
              if(s.type==="rect") return(
                <React.Fragment key={s.id}>
                  <KonvaRect {...p} x={s.x} y={s.y} width={s.width} height={s.height} fill={s.fill} stroke={s.stroke} strokeWidth={s.strokeWidth||2} rotation={s.rotation||0} cornerRadius={s.cornerRadius||0}/>
                  {hasLabel&&<KonvaText x={s.x} y={s.y} width={s.width} height={s.height} text={s.label} align="center" verticalAlign="middle" fontSize={Math.max(9,Math.min(13,s.width/s.label.length*1.3))} fill={s.stroke} rotation={s.rotation||0} listening={false} fontStyle="bold" padding={4}/>}
                </React.Fragment>
              );
              if(s.type==="ellipse") return(
                <React.Fragment key={s.id}>
                  <KonvaEllipse {...p} x={s.x} y={s.y} radiusX={s.radiusX} radiusY={s.radiusY} fill={s.fill} stroke={s.stroke} strokeWidth={s.strokeWidth||2} rotation={s.rotation||0}/>
                  {hasLabel&&<KonvaText x={s.x-s.radiusX} y={s.y-s.radiusY} width={s.radiusX*2} height={s.radiusY*2} text={s.label} align="center" verticalAlign="middle" fontSize={Math.max(8,Math.min(11,s.radiusX/s.label.length*1.6))} fill={s.stroke} rotation={s.rotation||0} listening={false} fontStyle="bold" padding={2}/>}
                </React.Fragment>
              );
              if(s.type==="polygon")return<KonvaLine {...p} points={s.points} fill={s.fill} stroke={s.stroke} strokeWidth={s.strokeWidth||2} closed={s.closed}/>;
              if(s.type==="line")return<KonvaLine {...p} points={s.points} stroke={s.stroke} strokeWidth={s.strokeWidth||2}/>;
              if(s.type==="text")return<KonvaText {...p} x={s.x} y={s.y} text={s.text} fontSize={s.fontSize||14} fill={s.fill} rotation={s.rotation||0}/>;
              return null;
            })}
            {/* Draw previews */}
            {preview?.type==="rect"&&<KonvaRect x={preview.x} y={preview.y} width={preview.width} height={preview.height} fill={preview.fill} stroke={preview.stroke} strokeWidth={2} opacity={0.6} listening={false} cornerRadius={0}/>}
            {preview?.type==="ellipse"&&<KonvaEllipse x={preview.x} y={preview.y} radiusX={preview.radiusX} radiusY={preview.radiusY} fill={preview.fill} stroke={preview.stroke} strokeWidth={2} opacity={0.6} listening={false}/>}
            {preview?.type==="line"&&<KonvaLine points={preview.points} stroke={preview.stroke} strokeWidth={2} opacity={0.6} listening={false}/>}
            {polyPts.length>=2&&<KonvaLine points={polyPts} stroke={activeColor} strokeWidth={2} dash={[5,3]} listening={false}/>}
            <KonvaTransformer ref={trRef} boundBoxFunc={(_,nw)=>({...nw,width:Math.max(5,nw.width),height:Math.max(5,nw.height)})}/>
          </Layer>
        </Stage>

        {/* Free text input */}
        {textInput&&(
          <div style={{position:"absolute",left:textInput.x,top:textInput.y,zIndex:10,display:"flex",gap:4,transform:"translate(0,-50%)"}}>
            <input autoFocus value={textVal} onChange={e=>setTextVal(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")commitText();if(e.key==="Escape"){setTextInput(null);setTextVal("");}}}
              style={{background:T.card,border:`1px solid ${T.blue}`,borderRadius:4,color:T.text,padding:"4px 8px",fontSize:13,fontFamily:T.font,outline:"none",minWidth:120}}
              placeholder="Testo..."/>
            <button onClick={commitText} style={{background:T.navActive,border:`1px solid ${alpha(T.blue,33)}`,borderRadius:4,color:T.blue,padding:"4px 8px",cursor:"pointer",fontSize:12}}>✓</button>
          </div>
        )}

        {/* Label edit overlay (dbl-click on stamped shape) */}
        {labelEditId&&(
          <div style={{position:"absolute",left:labelPos.x,top:labelPos.y,zIndex:10,display:"flex",gap:4,transform:"translate(-50%,-50%)"}}>
            <input autoFocus value={labelVal} onChange={e=>setLabelVal(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")commitLabel();if(e.key==="Escape"){setLabelEditId(null);setLabelVal("");}}}
              style={{background:T.card,border:`1px solid ${T.green}`,borderRadius:4,color:T.text,padding:"5px 10px",fontSize:13,fontFamily:T.font,outline:"none",minWidth:140,textAlign:"center"}}
              placeholder="Etichetta..."/>
            <button onClick={commitLabel} style={{background:"#0a1a0a",border:`1px solid ${alpha(T.green,33)}`,borderRadius:4,color:T.green,padding:"5px 9px",cursor:"pointer",fontSize:12}}>✓</button>
            <button onClick={()=>{setLabelEditId(null);setLabelVal("");}} style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:4,color:T.textDim,padding:"5px 9px",cursor:"pointer",fontSize:12}}>✕</button>
          </div>
        )}

        {/* Hint bar at bottom of canvas */}
        <div style={{position:"absolute",bottom:6,left:10,fontSize:10,color:T.textDim,pointerEvents:"none"}}>
          {tool==="select"&&!selectedId&&"Clicca per selezionare · Dbl-click per rinominare · Trascina per spostare"}
          {tool==="select"&&selectedId&&`${selectedShape?.label||selectedShape?.type||""} selezionato · Dbl-click per rinominare`}
        </div>
      </div>
    </div>
  );
}

export default CdrCanvas;
