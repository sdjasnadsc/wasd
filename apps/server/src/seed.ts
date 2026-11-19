import { prepareCalendar } from './dive.ts';
import { questions, sql } from './db.ts';
prepareCalendar();
console.log(`Seed ready with ${questions().length} trivia prompts.`);
sql.close();
