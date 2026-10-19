// Library98 sample rules. No Library99 save data or runtime is imported.
export const SHIFT_SECONDS=180;
export const CATEGORIES=['총류','철학','종교','사회과학','자연과학','기술과학','예술','언어','문학','역사'];
const koreanOrder=new Intl.Collator('ko-KR');
export function splitCallNumber(value){
 const m=String(value).replace(/[\s-]/g,'').match(/^(\d+(?:\.\d+)?)([가-힣ㄱ-ㅎㅏ-ㅣ]+)(\d+)([가-힣ㄱ-ㅎㅏ-ㅣ]+)$/);
 if(!m)throw Error('청구기호를 확인해 주세요: '+value);
 return {classification:Number(m[1]),classificationText:m[1],author:m[2],number:m[3],suffix:m[4]};
}
export function compareCallNumbers(a,b){
 const x=splitCallNumber(a),y=splitCallNumber(b);
 if(x.classification!==y.classification)return x.classification-y.classification;
 const author=koreanOrder.compare(x.author,y.author);if(author)return author;
 // Compare the author digits as fractional digits, preserving leading zeroes.
 const size=Math.max(x.number.length,y.number.length),nx=x.number.padEnd(size,'0'),ny=y.number.padEnd(size,'0');
 if(nx!==ny)return nx<ny?-1:1;
 return koreanOrder.compare(x.suffix,y.suffix);
}
export function insertionSlot(books,target){return books.filter(b=>compareCallNumbers(b,target)<0).length}
export function labelParts(code){const p=splitCallNumber(code);return [p.classificationText,p.author+p.number+p.suffix]}
export const SORT_LESSONS=[
 {title:'1 / 4 · 첫 숫자',hint:'맨 앞의 분류번호를 숫자순으로 비교해요. 소수점 뒤까지 확인하세요.',books:['206.5가12ㄴ','206.7가12ㄴ','206.8가12ㄴ','207가12ㄴ','208.15가12ㄴ'],target:'206.85가12ㄴ'},
 {title:'2 / 4 · 첫 문자',hint:'분류번호가 같으면 그 뒤의 문자를 가나다순으로 비교해요.',books:['808.3가12ㄴ','808.3나12ㄴ','808.3다12ㄴ','808.3마12ㄴ','808.3바12ㄴ'],target:'808.3라12ㄴ'},
 {title:'3 / 4 · 문자 뒤 숫자',hint:'문자 뒤 숫자는 소수의 자릿수처럼 왼쪽부터 비교해요. 808.3가125ㄴ은 808.3가55ㄴ보다 앞에 와요.',books:['808.3가12ㄴ','808.3가125ㄴ','808.3가3ㄴ','808.3가6ㄴ','808.3가7ㄴ'],target:'808.3가55ㄴ'},
 {title:'4 / 4 · 마지막 문자',hint:'앞부분이 모두 같으면 마지막 문자를 가나다순으로 비교해요.',books:['808.3가55ㄱ','808.3가55ㄴ','808.3가55ㄷ','808.3가55ㅁ','808.3가55ㅂ'],target:'808.3가55ㄹ'},
];
export function workClock(elapsed){const minutes=9*60+Math.min(SHIFT_SECONDS,Math.max(0,elapsed))/SHIFT_SECONDS*240;return {minutes,text:String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(Math.floor(minutes%60)).padStart(2,'0')}}
export function newRecord(){return {day:1,elapsed:0,mistakes:0,previousMistakes:0,counted:[],failed:false,served:0,shelved:0,totalServed:0,totalShelved:0,hp:5}}
export function recordMistake(record,eventId){
 if(record.failed||record.counted.includes(eventId))return false;
 record.counted.push(eventId);record.mistakes++;
 record.failed=record.mistakes>=3||(record.previousMistakes>=2&&record.mistakes>=2);
 return true;
}
export function nextRecordDay(record){record.previousMistakes=record.mistakes;record.day++;record.elapsed=0;record.mistakes=0;record.counted=[];record.served=0;record.shelved=0}
export const WORK_BOOKS=[
 {id:'work-1',title:'오늘의 이야기',code:'813.8가12ㄴ',category:8},
 {id:'work-2',title:'소설을 읽는 시간',code:'813.8나24ㄱ',category:8},
 {id:'work-3',title:'나의 독서 기록',code:'814.6다55ㄷ',category:8},
];
