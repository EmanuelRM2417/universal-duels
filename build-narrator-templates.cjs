/* Auditoría reproducible de los mensajes emitidos por el motor compartido. */
const fs=require('fs');
let ts;try{ts=require('typescript');}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js');}
const path=require('path');const root=__dirname;
const args=process.argv.slice(2).filter(x=>x!=='--check');
const source=fs.readFileSync(args[0]||path.join(root,'battle-engine.js'),'utf8');
const sf=ts.createSourceFile('battle-engine.js',source,ts.ScriptTarget.ESNext,true,ts.ScriptKind.JS);
function variable(expr){const txt=expr.getText(sf);
 if(/battleLogName\((?:attacker|user|owner|a|actor)\)/.test(txt))return 'ATACANTE';
 if(/battleLogName\((?:defender|target|t|a)\)/.test(txt))return 'PERSONAJE';
 if(/item\.name|consumable\.name/i.test(txt))return 'CONSUMIBLE';
 if(/\.name/.test(txt)&&/move|m\?/.test(txt))return 'MOVIMIENTO';
 if(/\.hp|remaining|amount|damage|actual|dealt/.test(txt))return 'DAÑO';
 if(/round|turn|hit|count/.test(txt))return 'NUMERO';
 if(/sourceSuffix/.test(txt))return 'ORIGEN';
 return 'VALOR';
}
function body(t){
 if(ts.isStringLiteral(t)||ts.isNoSubstitutionTemplateLiteral(t))return [t.text];
 if(ts.isTemplateExpression(t)){let out=[t.head.text];for(const span of t.templateSpans){const names=ts.isConditionalExpression(span.expression)?body(span.expression):['['+variable(span.expression)+']'];out=out.flatMap(a=>names.map(b=>a+b+span.literal.text));}return out;}
 if(ts.isBinaryExpression(t)&&t.operatorToken.kind===ts.SyntaxKind.PlusToken){const left=body(t.left),right=body(t.right);return left.flatMap(a=>right.map(b=>a+b)).slice(0,40);}
 if(ts.isConditionalExpression(t))return [...body(t.whenTrue),...body(t.whenFalse)];
 return ['['+variable(t)+']'];
}
const items=[],seen=new Set();let occurrences=0;
function visit(n){if(ts.isCallExpression(n)&&/(?:^|\.)log\.push$/.test(n.expression.getText(sf))){occurrences++;
 const arg=n.arguments[0];if(arg)for(const variant of body(arg)){
 const counts={};const pattern=variant.replace(/\s+/g,' ').trim().replace(/\[([A-ZÁÉÍÓÚÑ_0-9]{2,24})\]/g,(full,key)=>{counts[key]=(counts[key]||0)+1;return counts[key]===1?full:'['+key+counts[key]+']';});if(!pattern||pattern.replace(/\[[^\]]+\]/g,'').replace(/[^\p{L}]/gu,'').length<4||seen.has(pattern))continue;
 seen.add(pattern);items.push(['Motor de combate',pattern.slice(0,240)]);
 }}ts.forEachChild(n,visit);}visit(sf);
const extras=[
 ['Ataques secundarios','[ATACANTE] usa [EFECTO] sobre [OBJETIVO].'],
 ['Estadísticas','[ESTADÍSTICA] de [PERSONAJE] subió +[NIVELES].'],
 ['Estadísticas','[ESTADÍSTICA] de [PERSONAJE] bajó -[NIVELES].'],
 ['Estadísticas','[ESTADÍSTICA] de [PERSONAJE] subió +[NIVELES] por [ORIGEN].'],
 ['Estadísticas','[ESTADÍSTICA] de [PERSONAJE] bajó -[NIVELES] por [ORIGEN].'],
 ['Entornos','[CAMPO] se activó.'],
 ['Entornos','[CAMPO] se desactivó.'],
 ['Entornos','Ahora hay [CLIMA].'],
 ['Entornos','[CLIMA] desapareció.'],
 ['Entornos','Ahora estamos en [ESCENARIO].'],
 ['Entornos','Ya no estamos en [ESCENARIO].'],
 ['Entornos','Entorno inicial: [ENTORNO] (5 rondas).'],
 ['Entornos','Termina el entorno.'],
 ['Efectos de entorno','[ENTORNO]: [PERSONAJE] pierde [PS] PS ([PORCENTAJE] %).'],
 ['Efectos de entorno','[ENTORNO]: [PERSONAJE] recupera [PS] PS ([PORCENTAJE] %).'],
 ['Efectos de entorno','[ENTORNO]: cooldown activo de [MOVIMIENTO] en [PERSONAJE] +[NIVELES] → [NUMERO].'],
 ['Efectos de entorno','[ENTORNO]: cooldown activo de [MOVIMIENTO] en [PERSONAJE] [NIVELES] → [NUMERO].'],
 ['Efectos de entorno','[ENTORNO]: [PERSONAJE] pierde [ESTADO].'],
 ['Consumibles','[PERSONAJE] recupera [PS] PS por [CONSUMIBLE].'],
 ['Combate','— Ronda [NUMERO] —'],
 ['Movimientos','Es fuerte.'],
 ['Movimientos','Es débil.'],
 ['Movimientos','Es muy fuerte.'],
 ['Movimientos','Es muy débil.'],
 ['Estados','[PERSONAJE] deja de tener [ESTADO].'],
 ['Cambios','[TIPO]: [PERSONAJE] entra al campo.'],
 ['Cooldowns','[PERSONAJE] tiene [NUMERO] turno restante para poder volver a usar [MOVIMIENTO].'],
 ['Cooldowns','[PERSONAJE] tiene [NUMERO] turnos restantes para poder volver a usar [MOVIMIENTO].'],
 ['Cooldowns','[PERSONAJE] puede volver a usar [MOVIMIENTO].'],
 ['Consumibles','[PERSONAJE] consumió [CONSUMIBLE].'],
 ['Movimientos','[ATACANTE] usó [MOVIMIENTO].'],
 ['Daño','[PERSONAJE] recibió [DAÑO] de daño (golpe [NUMERO]).'],
 ['Daño','[PERSONAJE] recibe [DAÑO] de daño por [ORIGEN].'],
 ['Estadísticas','[ESTADÍSTICA] de [PERSONAJE] subió +[NIVELES].'],
 ['Estadísticas','[ESTADÍSTICA] de [PERSONAJE] bajó -[NIVELES].'],
 ['Estadísticas','[ESTADÍSTICA] de [PERSONAJE] subió +[NIVELES] por [ORIGEN].'],
 ['Estadísticas','[ESTADÍSTICA] de [PERSONAJE] bajó -[NIVELES] por [ORIGEN].'],
 ['Entornos','[CAMPO] se activó.'],['Entornos','[CAMPO] se desactivó.'],
 ['Entornos','Ahora hay [CLIMA].'],['Entornos','[CLIMA] desapareció.'],
 ['Entornos','Ahora estamos en [ESCENARIO].'],['Entornos','Ya no estamos en [ESCENARIO].'],
 ['Cambios','Cambio: [PERSONAJE] entra al campo.'],
 ['Cambios','Relevo: [PERSONAJE] entra al campo.'],
 ['Cambios','Cambio por efecto: [PERSONAJE] entra al campo.'],
 ['Cambios','Reemplazo: [PERSONAJE] entra al campo.'],
];
for(const [category,pattern] of extras){if(!seen.has(pattern)){items.push([category,pattern]);seen.add(pattern);}}
const out=args[1]||path.join(root,'public/editor/narrator-engine-templates.js');
const generated=`/* Generado a partir de los mensajes del motor: ${occurrences} llamadas log.push. */\nwindow.udEngineNarratorTemplates=${JSON.stringify(items,null,2)};\n`;
if(process.argv.includes('--check')){if(!fs.existsSync(out)||fs.readFileSync(out,'utf8')!==generated){console.error('Plantillas del narrador sin regenerar o desactualizadas.');process.exit(1);}}
else fs.writeFileSync(out,generated);
console.log(`${occurrences} puntos de emisión examinados; ${items.length} patrones del motor y variantes guardados.`);
