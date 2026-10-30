import test from 'node:test';
import assert from 'node:assert/strict';
import { ClientMessageSchema, ServerMessageSchema, SnapshotSchema, TimerSchema, GameSeedSchema, CreateLobbyResponseSchema, GAME_CONFIG } from '../dist/index.js';

const options = ['a','b','c','d'].map(id => ({id,text:id.toUpperCase()}));
const game = {id:'g1',kind:'quiz',title:'Quiz',rules:'1 point'};
const base = {version:1,type:'snapshot',lobbyId:'l1',revision:0,serverTime:1000,phase:'lobby',participants:[],catalog:[{...game,played:false}],selectedGameId:null,ranking:[],rankingTransition:null};
const round = {roundId:'r1',game,questionIndex:0,questionCount:2,phase:'playing',task:{kind:'quiz',question:'Q?',options},timer:{roundId:'r1',serverTime:1000,deadline:31000,acceptUntil:33000,inputClosed:false,canReveal:false}};
const player = {...base,role:'player',playerId:'p1',input:{answer:null,final:false,participating:true},phase:'playing',round};

test('all protocol commands have valid round/session envelopes and reject unknown payload fields', () => {
  const commands = [
    {type:'auth',lobbyId:'l1',sessionId:'s1',token:'x'.repeat(43)}, {type:'lobby.start'},
    {type:'player.name',name:''}, {type:'game.select',gameId:null}, {type:'game.prepare'}, {type:'game.start',roundId:'r1'},
    {type:'game.reveal',roundId:'r1'}, {type:'game.next',roundId:'r1'}, {type:'game.finish',roundId:'r1'},
    {type:'answer.set',roundId:'r1',answer:{kind:'quiz',optionId:'a'}},
    {type:'answer.submit',roundId:'r1',answer:{kind:'sorting',termIds:['a','b']}},
    {type:'answer.submit',roundId:'r1',answer:{kind:'estimation',value:-1.5}}, {type:'time.sync',clientTime:1000},
  ];
  for (const command of commands) {
    const message = {version:1,requestId:'req1',...command};
    assert.equal(ClientMessageSchema.safeParse(message).success,true,command.type);
    assert.equal(ClientMessageSchema.safeParse({...message,role:'host'}).success,false);
  }
  assert.equal(ClientMessageSchema.safeParse({version:2,requestId:'x',type:'lobby.start'}).success,false);
  assert.equal(ClientMessageSchema.safeParse({version:1,requestId:'x',type:'answer.submit',answer:{kind:'quiz',optionId:'a'}}).success,false);
});

test('game.start must identify the round being started so a delayed command cannot start another round', () => {
  const command = {version:1,requestId:'start1',type:'game.start'};
  assert.equal(ClientMessageSchema.safeParse({...command,roundId:'r1'}).success,true);
  assert.equal(ClientMessageSchema.safeParse(command).success,false);
});

test('wire snapshots validate each role and reject solution/private field leakage', () => {
  assert.equal(SnapshotSchema.safeParse(player).success,true);
  assert.equal(ServerMessageSchema.safeParse({...base,role:'host',round:null,canStartLobby:false,links:{player:'/lobbies/l1/join',projector:'/lobbies/l1/projector'}}).success,true);
  assert.equal(ServerMessageSchema.safeParse({...base,role:'projector',round:null,playerLink:'/lobbies/l1/join'}).success,true);
  for(const field of ['correctOptionId','target','value','token']) {
    assert.equal(SnapshotSchema.safeParse({...player,round:{...round,task:{...round.task,[field]:'secret'}}}).success,false,field);
  }
  assert.equal(SnapshotSchema.safeParse({...player,otherAnswers:[]}).success,false);
  assert.equal(SnapshotSchema.safeParse({...base,role:'projector',input:player.input,round:null}).success,false);
  assert.equal(SnapshotSchema.safeParse({...base,role:'projector',phase:'playing',round}).success,false,'projector cannot receive quiz options');
  assert.equal(SnapshotSchema.safeParse({...player,phase:'overview'}).success,false,'phase must match round');
});

test('all game seeds enforce correct option, unique IDs, unique sorting values and finite numbers', () => {
  const quiz = {id:'g1',kind:'quiz',title:'Quiz',questions:[{id:'q1',question:'Q',options,correctOptionId:'a'}]};
  assert.equal(GameSeedSchema.safeParse(quiz).success,true);
  assert.equal(GameSeedSchema.safeParse({...quiz,questions:[{...quiz.questions[0],correctOptionId:'missing'}]}).success,false);
  assert.equal(GameSeedSchema.safeParse({...quiz,questions:[{...quiz.questions[0],options:options.slice(1)}]}).success,false);
  assert.equal(GameSeedSchema.safeParse({...quiz,questions:[{...quiz.questions[0],options:[options[0],options[0],options[2],options[3]]}]}).success,false);
  const sort={id:'s',kind:'sorting',title:'Sort',question:'Q',terms:[{id:'a',text:'A',value:1},{id:'b',text:'B',value:2}]};
  assert.equal(GameSeedSchema.safeParse(sort).success,true);
  assert.equal(GameSeedSchema.safeParse({...sort,terms:sort.terms.map(t=>({...t,value:1}))}).success,false);
  const estimate={id:'e',kind:'estimation',title:'Estimate',question:'Q',target:2};
  assert.equal(GameSeedSchema.safeParse(estimate).success,true);
  assert.equal(GameSeedSchema.safeParse({...estimate,target:Infinity}).success,false);
  // TECH-16: Regeln gehoeren zur Spielart (GAME_CONFIG), nicht in den Upload/die DB.
  assert.equal(GameSeedSchema.safeParse({...quiz,rules:'custom'}).success,false,'seeds with rules must be rejected');
  assert.equal(ClientMessageSchema.safeParse({version:1,requestId:'x',type:'answer.set',roundId:'r',answer:{kind:'estimation',value:NaN}}).success,false);
});

test('GAME_CONFIG provides rules text and scoring parameters for every game kind', () => {
  for (const kind of ['quiz','sorting','estimation']) {
    const config = GAME_CONFIG[kind];
    assert.ok(config, `missing config for ${kind}`);
    assert.equal(typeof config.rules, 'string');
    assert.ok(config.rules.length > 0);
    assert.ok(config.scoring && typeof config.scoring === 'object', `missing scoring for ${kind}`);
  }
  assert.equal(GAME_CONFIG.quiz.scoring.pointsPerCorrectAnswer, 3);
  assert.equal(GAME_CONFIG.sorting.scoring.pointsPerCorrectPosition, 1);
  assert.equal(GAME_CONFIG.estimation.scoring.upperThird, 3);
  assert.equal(GAME_CONFIG.estimation.scoring.middleThird, 1);
  assert.equal(GAME_CONFIG.estimation.scoring.lowerThird, 0);
  assert.equal(GAME_CONFIG.estimation.scoring.bestBonus, 2);
});

// TECH-18: Host-Kick — player.remove-Kommando, optionales submitted-Flag
// auf Participants (host-sichtbar), PLAYER_NOT_FOUND als Wire-Error.
test('host removal command validates playerId and protocol envelope', () => {
  assert.equal(ClientMessageSchema.safeParse({version:1,requestId:'req1',type:'player.remove',playerId:'p1'}).success,true);
  assert.equal(ClientMessageSchema.safeParse({version:1,requestId:'req1',type:'player.remove'}).success,false);
  assert.equal(ClientMessageSchema.safeParse({version:1,requestId:'req1',type:'player.remove',playerId:''}).success,false);
  assert.equal(ClientMessageSchema.safeParse({version:1,requestId:'req1',type:'player.remove',playerId:'p1',extra:true}).success,false);
});

test('participant submitted flag is optional boolean and PLAYER_NOT_FOUND is a wire error', () => {
  const participant={id:'p1',name:'A',number:1,connected:true,waiting:false};
  assert.equal(SnapshotSchema.safeParse({...player,participants:[participant]}).success,true);
  assert.equal(SnapshotSchema.safeParse({...player,participants:[{...participant,submitted:true}]}).success,true);
  assert.equal(SnapshotSchema.safeParse({...player,participants:[{...participant,submitted:'ja'}]}).success,false);
  assert.equal(ServerMessageSchema.safeParse({version:1,type:'error',requestId:null,code:'PLAYER_NOT_FOUND',message:'gone'}).success,true);
});

test('timer enforces inclusive two-second acceptance deadline and reveal state', () => {
  assert.equal(TimerSchema.safeParse(round.timer).success,true);
  assert.equal(TimerSchema.safeParse({...round.timer,acceptUntil:33001}).success,false);
  assert.equal(TimerSchema.safeParse({...round.timer,canReveal:true}).success,false);
});

test('evaluation exposes solutions only with role-appropriate own or aggregate results', () => {
  const solution={kind:'quiz',question:'Q',options,correctOptionId:'a'};
  const evaluation={roundId:'r1',game,questionIndex:0,questionCount:2,phase:'evaluation',solution,hasNextQuestion:true};
  assert.equal(SnapshotSchema.safeParse({...player,phase:'evaluation',round:{...evaluation,ownEvaluation:{answer:{kind:'quiz',optionId:'b'},points:0,distance:null,positionsCorrect:null}}}).success,true);
  assert.equal(SnapshotSchema.safeParse({...base,phase:'evaluation',role:'projector',playerLink:'/lobbies/l1/join',round:{...evaluation,results:[]}}).success,true);
  assert.equal(SnapshotSchema.safeParse({...player,phase:'evaluation',round:{...evaluation,results:[]}}).success,false);
});

test('REST creation has separate roles and names reject overlong input', () => {
  const session={lobbyId:'l1',sessionId:'s1',token:'x'.repeat(43)};
  const response={version:1,lobbyId:'l1',host:{...session,role:'host'},projector:{...session,sessionId:'s2',role:'projector'},links:{host:'/lobbies/l1/host#sessionId=s1&token=redacted',player:'/lobbies/l1/join',projector:'/lobbies/l1/projector#sessionId=s2&token=redacted'}};
  assert.equal(CreateLobbyResponseSchema.safeParse(response).success,true);
  assert.equal(CreateLobbyResponseSchema.safeParse({...response,host:{...session,role:'player'}}).success,false);
  assert.equal(ClientMessageSchema.safeParse({version:1,requestId:'x',type:'player.name',name:'x'.repeat(21)}).success,false);
});
