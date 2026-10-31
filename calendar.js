const {Solar} = require('lunar-javascript');
const KoreanCalendar = require('korean-lunar-calendar');
const GAN='甲乙丙丁戊己庚辛壬癸', ZHI='子丑寅卯辰巳午未申酉戌亥';
const READ='갑을병정무기경신임계자축인묘진사오미신유술해';
const HAN=GAN+ZHI;
const ELEMENTS=['목','화','토','금','수'];
const ZE=[4,2,0,0,2,1,1,2,3,3,2,4];
const MIN='1900-01-01', MAX='2050-12-31';
function iso(y,m,d){return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
function shift(date,minutes){const [y,m,d]=date.split('-').map(Number);const dt=new Date(Date.UTC(y,m-1,d,0,minutes));return [dt.getUTCFullYear(),dt.getUTCMonth()+1,dt.getUTCDate(),dt.getUTCHours(),dt.getUTCMinutes()];}
function validateSolar(date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<MIN||date>MAX)throw Error('양력 날짜는 1900-01-01~2050-12-31 범위로 입력해 주세요.');
 const [y,m,d]=date.split('-').map(Number),c=new KoreanCalendar();
 if(!c.setSolarDate(y,m,d))throw Error('존재하지 않는 양력 날짜입니다.');
 return c;
}
function convertBirth({date,calendar='solar',leap=false}){
 if(calendar==='solar') {validateSolar(date);return date;}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('음력 생년월일을 확인해 주세요.');
 const [y,m,d]=date.split('-').map(Number),c=new KoreanCalendar();
 if(!c.setLunarDate(y,m,d,leap))throw Error('지원하지 않는 음력 날짜이거나, 해당 해에 존재하지 않는 윤달입니다.');
 const lunar=c.getLunarCalendar();
 if(!!lunar.intercalation!==!!leap)throw Error('해당 해의 해당 월은 윤달이 아닙니다.');
 const s=c.getSolarCalendar(),result=iso(s.year,s.month,s.day); validateSolar(result);return result;
}
function exactYM(date,minutes){
 // lunar-javascript expresses solar terms in UTC+8. KST's clock is one hour ahead.
 const a=shift(date,minutes-60),l=Solar.fromYmdHms(...a,0).getLunar();
 return {year:l.getYearInGanZhiExact(),month:l.getMonthInGanZhiExact()};
}
function pillars(date,time='12:00',unknown=false){
 validateSolar(date);
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('출생 시각을 00:00~23:59로 입력해 주세요.');
 const [h,m]=time.split(':').map(Number),[y,mo,d]=date.split('-').map(Number);
 const day=Solar.fromYmdHms(y,mo,d,h,m,0).getLunar().getDayInGanZhi();
 const start=exactYM(date,0),end=exactYM(date,1439),known=exactYM(date,h*60+m);
 const uncertain=[];
 if(unknown && start.year!==end.year)uncertain.push('year');
 if(unknown && start.month!==end.month)uncertain.push('month');
 const branch=Math.floor((h+1)/2)%12;
 const timeP=GAN[(GAN.indexOf(day[0])%5*2+branch)%10]+ZHI[branch];
 return {year:uncertain.includes('year')?null:(unknown?start.year:known.year),month:uncertain.includes('month')?null:(unknown?start.month:known.month),day,time:unknown?null:timeP,uncertain,alternatives:{year:[start.year,end.year],month:[start.month,end.month]}};
}
function read(s){return [...s].map(ch=>READ[HAN.indexOf(ch)]||ch).join('');}
function element(ch){let i=GAN.indexOf(ch);return i>=0?Math.floor(i/2):ZE[ZHI.indexOf(ch)];}
function tenGod(day,other){
 const a=GAN.indexOf(day), b=GAN.indexOf(other);if(a<0||b<0)throw Error('천간 입력 오류');
 const delta=(Math.floor(b/2)-Math.floor(a/2)+5)%5,same=a%2===b%2;
 return [['비견','겁재'],['식신','상관'],['편재','정재'],['편관','정관'],['편인','정인']][delta][same?0:1];
}
function distribution(p){const counts=[0,0,0,0,0];for(const k of ['year','month','day','time'])if(p[k])for(const ch of p[k])counts[element(ch)]++;return counts;}
const COMBINE=['子丑','寅亥','卯戌','辰酉','巳申','午未'];
const CLASH=['子午','丑未','寅申','卯酉','辰戌','巳亥'];
function relations(p,target){
 const result=[];for(const key of ['year','month','day','time'])if(p[key]){
  const b=p[key][1],t=target[1],pair=b+t;
  if(COMBINE.some(x=>x===pair||x===[...pair].reverse().join('')))result.push({key,kind:'합',pair});
  if(CLASH.some(x=>x===pair||x===[...pair].reverse().join('')))result.push({key,kind:'충',pair});
 }return result;
}
function targetAt(date){return pillars(date,'12:00');}
function periodData(type,date,birth){
 validateSolar(date);const [y,m,d]=date.split('-').map(Number);let representative=date;
 if(type==='month')representative=iso(y,m,15);if(type==='year')representative=iso(y,7,1);
 const p=targetAt(representative),target=type==='day'?p.day:type==='month'?p.month:p.year;
 const god=tenGod(birth.day[0],target[0]),rel=relations(birth,target);
 const timeline=[];
 if(type==='day')for(const [label,time,action] of [['오전','08:00','가장 중요한 일 하나를 정하고 필요한 자료부터 확인하세요.'],['오후','14:00','진행 상황을 확인하고 상대와 기대치를 맞춰 보세요.'],['저녁','20:00','오늘의 선택을 기록하고 내일의 여유를 남겨 두세요.']]){const q=pillars(date,time);timeline.push({label,pillar:q.time,god:tenGod(birth.day[0],q.time[0]),action});}
 if(type==='month')for(let i=0;i<4;i++){const dt=iso(y,m,[4,11,18,25][i]),q=targetAt(dt);timeline.push({label:`${i+1}주 점검 · ${m}/${[4,11,18,25][i]} 정오`,date:dt,pillar:q.month,god:tenGod(birth.day[0],q.month[0]),action:['계획과 가용 시간을 대조하세요.','소비·약속·업무의 중간 기록을 살피세요.','밀린 일의 범위를 줄이고 협의하세요.','완료와 이월을 구분해 다음 달에 연결하세요.'][i]});}
 if(type==='year')for(let i=1;i<=12;i++){const dt=iso(y,i,15),q=targetAt(dt);timeline.push({label:`${i}월 · 15일 정오`,date:dt,pillar:q.month,god:tenGod(birth.day[0],q.month[0]),action:['기록 기준을 정하세요.','새 계획은 작은 단위로 시작하세요.','약속과 역할을 확인하세요.','배운 것을 실행해 보세요.','소비 항목을 점검하세요.','상반기 진행을 돌아보세요.','하반기 우선순위를 정하세요.','여유 시간을 확보하세요.','협업 방식을 조율하세요.','미완료 과제의 범위를 줄이세요.','연말 지출을 계획하세요.','한 해의 선택과 배움을 정리하세요.'][i-1]});}
 return {type,date,representative,target,god,rel,timeline,birth};
}
module.exports={Solar,MIN,MAX,GAN,ZHI,ELEMENTS,iso,shift,validateSolar,convertBirth,pillars,read,element,tenGod,distribution,relations,periodData,exactYM};
