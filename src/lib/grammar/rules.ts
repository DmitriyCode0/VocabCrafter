export const GRAMMAR_RULES: Record<string, string> = {
  // ===== A1 =====

  "Present Simple with verb: positive": `Structure: Subject + base verb (add -s/-es for he/she/it).
Use for habits, routines, facts, and permanent states.
Examples:
- I drink coffee every morning.
- She works in an office.
- They live in London.`,

  "Present Simple with verb: negative": `Structure: Subject + do/does + not + base verb.
Use 'don't' with I/you/we/they; 'doesn't' with he/she/it.
Examples:
- I don't like spiders.
- He doesn't play football.
- We don't watch TV in the morning.`,

  "Present Simple with verb: questions": `Structure: Do/Does + subject + base verb?
Use 'Do' with I/you/we/they; 'Does' with he/she/it.
Examples:
- Do you speak English?
- Does she work here?
- Do they live near the school?`,

  "Present Simple with verb mix: +, -, ?": `Combines positive, negative, and question forms of Present Simple with action verbs.
Positive: Subject + verb(s/es). Negative: Subject + don't/doesn't + verb. Question: Do/Does + subject + verb?
Examples:
- She reads books. / She doesn't read books. / Does she read books?
- They play tennis. / They don't play tennis. / Do they play tennis?`,

  "Present Simple Verb 'To Be' positive": `Structure: Subject + am/is/are + complement.
I am, he/she/it is, you/we/they are.
Examples:
- I am a student.
- She is happy.
- They are from Spain.`,

  "Present Simple Verb 'To Be' negative": `Structure: Subject + am/is/are + not.
Contractions: I'm not, he/she/it isn't, you/we/they aren't.
Examples:
- I'm not tired.
- He isn't a teacher.
- We aren't ready yet.`,

  "Present Simple Verb 'To Be' questions": `Structure: Am/Is/Are + subject + complement?
Examples:
- Are you a student?
- Is she from Italy?
- Are they at home?`,

  "Present Simple 'To Be' vs 'To Do' mix: positive, negative, questions": `'To Be' describes states/identity (am/is/are). Action verbs use 'do/does' for negatives and questions.
Do NOT use 'do' with 'be': "Are you happy?" NOT "Do you be happy?"
Examples:
- She is a doctor. / She doesn't work on Sundays. (be vs do)
- Are you tired? / Do you want coffee? (be vs do)
- He isn't here. / He doesn't know the answer.`,

  "Present Continuous": `Structure: Subject + am/is/are + verb-ing.
Use for actions happening now, temporary situations, or future arrangements.
Examples:
- I am studying English right now.
- She is wearing a red dress today.
- They are meeting us at 6 pm tomorrow.`,

  "Was / Were": `Structure: Subject + was/were (+ complement).
Was: I/he/she/it. Were: you/we/they.
Negative: wasn't/weren't. Questions: Was/Were + subject?
Examples:
- I was at home yesterday.
- They were happy about the news.
- Was she at the party? / We weren't ready.`,

  "Past Simple": `Structure: Subject + verb in past form (regular: +ed; irregular: 2nd form).
Negative: didn't + base verb. Questions: Did + subject + base verb?
Examples:
- I visited Paris last summer.
- She didn't go to school yesterday.
- Did you watch the film?`,

  "Future: Going to": `Structure: Subject + am/is/are + going to + base verb.
Use for plans, intentions, and predictions based on evidence.
Examples:
- I'm going to study medicine.
- Look at those clouds — it's going to rain.
- They are going to move to a new house.`,

  "Future: Will": `Structure: Subject + will + base verb.
Use for spontaneous decisions, promises, offers, predictions (opinion).
Examples:
- I'll help you with your homework.
- It will probably rain tomorrow.
- She won't come to the party.`,

  "Can, Could": `'Can' expresses present ability or permission. 'Could' expresses past ability or polite requests.
Structure: Subject + can/could + base verb.
Examples:
- I can swim very well.
- She could read when she was four.
- Could you open the window, please?`,

  Imperatives: `Structure: Base verb (no subject) for commands, instructions, or requests.
Negative: Don't + base verb.
Examples:
- Sit down, please.
- Don't touch that!
- Open your books to page 10.`,

  "Verb Patterns (Inf/Ger)": `Some verbs are followed by the infinitive (to + verb), others by the gerund (verb-ing).
Infinitive after: want, need, decide, hope, learn. Gerund after: enjoy, finish, mind, avoid, suggest.
Examples:
- I want to learn English.
- She enjoys reading books.
- They decided to stay home.`,

  "Countable & Uncountable": `Countable nouns have singular and plural forms (a book / books). Uncountable nouns have no plural (water, information).
Use a/an with singular countable. Use some/much/a lot of with uncountable.
Examples:
- I need a pen. / I need some pens.
- There is some water on the table.
- How much money do you have? / How many friends do you have?`,

  "Subject Pronouns": `Subject pronouns replace the subject noun: I, you, he, she, it, we, they.
They come before the verb.
Examples:
- John is tall. → He is tall.
- The cat is sleeping. → It is sleeping.
- Maria and I are friends. → We are friends.`,

  "Object Pronouns": `Object pronouns replace the object noun: me, you, him, her, it, us, them.
They come after the verb or preposition.
Examples:
- Call John. → Call him.
- Give the book to Mary. → Give it to her.
- The teacher helped us with the exercise.`,

  "Subject Pronouns vs Object Pronouns": `Subject pronouns (I, he, she, we, they) come before the verb as the doer.
Object pronouns (me, him, her, us, them) come after the verb or preposition as the receiver.
Examples:
- She loves him. (she = subject, him = object)
- They invited us to the party.
- I gave her a present. / He told me the answer.`,

  "Possessive Adjectives": `Possessive adjectives show ownership: my, your, his, her, its, our, their.
They come before a noun.
Examples:
- This is my book.
- She loves her cat.
- They sold their house.`,

  "Subject Pronouns vs Object Pronouns vs Possessive Adjectives": `Three forms: Subject (I/he/she/we/they) before verb, Object (me/him/her/us/them) after verb, Possessive Adj (my/his/her/our/their) before noun.
Examples:
- I gave him my number. (I=subject, him=object, my=possessive)
- She told us her name.
- They asked me about our project.`,

  "This / That / These / Those": `Demonstratives: 'this/these' for near, 'that/those' for far.
This/that = singular. These/those = plural.
Examples:
- This book is interesting. (near, singular)
- Those cars are expensive. (far, plural)
- What is that? / I like these shoes.`,

  "Quantifiers many, much, little, few": `'Many' and 'few' with countable nouns. 'Much' and 'little' with uncountable nouns.
'A few/a little' = some (positive). 'Few/little' = not enough (negative).
Examples:
- There aren't many students today.
- I don't have much time.
- She has a few friends in London. / There is little water left.`,

  "There is / There are": `'There is' + singular/uncountable. 'There are' + plural.
Use to say that something exists or is in a place.
Examples:
- There is a book on the table.
- There are three cats in the garden.
- Is there any milk? / There aren't any chairs.`,

  "Comparative Adjectives": `Structure: adjective + -er + than (short adj) OR more + adjective + than (long adj).
Irregular: good → better, bad → worse, far → farther.
Examples:
- She is taller than her brother.
- This book is more interesting than that one.
- My results are better than last year.`,

  "Superlative Adjectives": `Structure: the + adjective + -est (short adj) OR the most + adjective (long adj).
Irregular: good → the best, bad → the worst.
Examples:
- She is the tallest girl in the class.
- This is the most expensive restaurant in town.
- He is the best player on the team.`,

  "Comparatives vs Superlatives Adjectives": `Comparative (-er/more): compares TWO things. Superlative (-est/most): compares THREE or more.
Examples:
- Tom is taller than Sam. (comparative — two people)
- Tom is the tallest in the class. (superlative — the whole class)
- This film is more exciting than that one. / It's the most exciting film I've ever seen.`,

  "Adverbs formation": `Most adverbs are formed by adding -ly to adjectives: quick → quickly, careful → carefully.
Irregular: good → well, fast → fast, hard → hard.
Examples:
- She speaks English fluently.
- He runs fast.
- They worked hard all day.`,

  "Comparatives & Superlatives Adverbs": `Comparative: more + adverb (or -er for short adverbs). Superlative: most + adverb (or -est).
Examples:
- She runs faster than me.
- He speaks more clearly than his brother.
- Of all the students, she works the hardest.`,

  "Prepositions of Time: at, in, on": `'At' for clock times and specific moments (at 5 pm, at night, at Christmas).
'In' for months, years, seasons, parts of day (in June, in 2024, in the morning).
'On' for days and dates (on Monday, on 5th March, on my birthday).
Examples:
- The meeting is at 3 o'clock.
- She was born in 1990.
- We have English on Wednesdays.`,

  "Prepositions of Place: at, in, on": `'At' for a specific point (at the bus stop, at home, at school).
'In' for enclosed spaces (in the room, in London, in a box).
'On' for surfaces (on the table, on the wall, on the second floor).
Examples:
- She is at the airport.
- The keys are in my bag.
- The picture is on the wall.`,

  "Other Prepositions": `Common prepositions: by, with, for, from, to, about, between, among, through, without, during.
Examples:
- This book was written by Hemingway.
- I went to the shop with my friend.
- She has lived here for three years. / We talked about the problem.`,

  "Conjunctions 'and but or so because'": `'And' adds information. 'But' shows contrast. 'Or' gives alternatives. 'So' shows result. 'Because' gives reason.
Examples:
- I like tea and coffee.
- She is tired but happy.
- Do you want tea or coffee?
- It was raining, so we stayed home.
- I stayed home because I was sick.`,

  "Question Words": `Who (people), What (things/info), Where (place), When (time), Why (reason), How (manner/way), Which (choice), Whose (possession).
Structure: Question word + auxiliary + subject + verb?
Examples:
- Where do you live?
- What time does the train leave?
- Why are you laughing? / How old is she?`,

  "Word Order": `Basic English word order: Subject + Verb + Object (SVO).
With adverbs of frequency: Subject + adverb + verb (She always drinks coffee).
With time/place: Subject + verb + object + place + time.
Examples:
- I eat breakfast every morning. (S+V+O+time)
- She usually walks to school. (S+adv+V+place)
- They played football in the park yesterday.`,

  "Have got": `Structure: Subject + have/has got + noun. Use to express possession (mainly British English).
Negative: haven't/hasn't got. Questions: Have/Has + subject + got?
Examples:
- I've got two brothers.
- She hasn't got a car.
- Have you got any pets?`,

  // ===== A2 =====

  "Present Simple vs Continuous": `Present Simple: habits, routines, facts (I work every day). Present Continuous: actions happening now or temporary situations (I'm working right now).
Signal words: Simple — always, usually, every day. Continuous — now, at the moment, today.
Examples:
- She works in a bank. (permanent job) / She is working from home today. (temporary)
- I usually walk to school. / Today I'm taking the bus.`,

  "Past Simple vs Continuous": `Past Simple: completed actions (I watched a film). Past Continuous: actions in progress at a specific past time (I was watching a film at 8 pm).
Past Continuous often sets the scene; Past Simple interrupts it.
Examples:
- I was cooking when the phone rang.
- While she was reading, the lights went out.
- They were playing football at 3 pm yesterday.`,

  "Present Perfect Basics": `Structure: Subject + have/has + past participle.
Use for experiences (ever/never), recent actions (just), and situations continuing to now (for/since).
Examples:
- I have visited Paris twice.
- She has just finished her homework.
- We have lived here since 2010.`,

  "Present Perfect vs Past Simple": `Present Perfect: connected to the present, no specific time (I have seen that film). Past Simple: finished action at a specific past time (I saw that film yesterday).
Key: Past Simple uses specific time markers (yesterday, last week, in 2020).
Examples:
- Have you ever been to Japan? / I went to Japan in 2019.
- She has lost her keys. (still lost) / She lost her keys yesterday. (specific time)`,

  "Past Perfect": `Structure: Subject + had + past participle.
Use for an action completed before another past action. It establishes the earlier of two past events.
Examples:
- When I arrived, she had already left.
- He didn't recognize the town because it had changed so much.
- I had never seen snow before I moved to Canada.`,

  "Future: Will vs Going to": `'Will' for spontaneous decisions, predictions (opinion), promises. 'Going to' for planned intentions and predictions based on evidence.
Examples:
- I'll have the chicken, please. (spontaneous) / I'm going to study law next year. (plan)
- I think it will rain. (opinion) / Look at those clouds — it's going to rain. (evidence)`,

  "Future: Present Continuous": `Use Present Continuous for fixed future arrangements (usually with other people).
There is often a specific time or place mentioned.
Examples:
- I'm meeting Sarah at 7 pm tonight.
- We're flying to Rome on Saturday.
- She's starting a new job next week.`,

  "Must / Have to": `'Must' for personal obligation or strong recommendation. 'Have to' for external obligation/rules.
Negative: 'mustn't' = prohibition; 'don't have to' = no obligation (it's optional).
Examples:
- I must remember to call her. (personal)
- You have to wear a uniform at school. (rule)
- You mustn't park here. / You don't have to come if you don't want to.`,

  "Should / Shouldn't": `Use 'should/shouldn't' for advice, recommendations, and mild obligation.
Structure: Subject + should + base verb.
Examples:
- You should see a doctor.
- She shouldn't eat so much sugar.
- Should I bring anything to the party?`,

  "May / Might (Possibility)": `'May' and 'might' express possibility. 'Might' is slightly less certain than 'may'.
Structure: Subject + may/might + base verb.
Examples:
- It may rain later.
- She might come to the party — I'm not sure.
- We may not have enough time.`,

  "Used to (Past Habits)": `Structure: Subject + used to + base verb.
Use for past habits or states that are no longer true.
Negative: didn't use to. Questions: Did + subject + use to?
Examples:
- I used to play football every weekend.
- She didn't use to like vegetables.
- Did you use to live in London?`,

  "First Conditional": `Structure: If + Present Simple, will + base verb.
Use for real/likely future situations and their results.
Examples:
- If it rains, I will take an umbrella.
- If you study hard, you will pass the exam.
- She won't come if you don't invite her.`,

  "Second Conditional": `Structure: If + Past Simple, would + base verb.
Use for unreal/unlikely present or future situations (hypothetical).
Examples:
- If I had more money, I would travel the world.
- If she lived closer, she would visit us more often.
- What would you do if you won the lottery?`,

  "Passive Voice (Simple)": `Structure: Subject + be + past participle (+ by agent).
Use when the action is more important than who does it, or the agent is unknown.
Present: is/are + pp. Past: was/were + pp.
Examples:
- English is spoken all over the world.
- The window was broken by the children.
- These cars are made in Germany.`,

  "Gerunds & Infinitives": `Gerund (verb-ing) after: enjoy, finish, mind, avoid, suggest, keep, practice.
Infinitive (to + verb) after: want, need, decide, hope, learn, plan, agree, refuse.
Some verbs take both with no change: like, love, hate, prefer, start, begin.
Examples:
- I enjoy reading. / I want to read.
- She suggested going to the cinema. / She decided to stay home.`,

  "Stative vs Dynamic Verbs": `Stative verbs describe states (know, believe, want, like, own, seem) — usually NOT used in continuous.
Dynamic verbs describe actions (run, eat, write) — used in both simple and continuous.
Some verbs can be both: think (opinion = stative / process = dynamic), have (possess = stative / experience = dynamic).
Examples:
- I know the answer. (NOT I am knowing)
- I'm thinking about the problem. (process) / I think you're right. (opinion)`,

  "Phrasal Verbs Basics": `Phrasal verbs = verb + particle (preposition/adverb) with a meaning different from the individual words.
Some are separable (turn off the light / turn the light off). Some are inseparable (look after children).
Examples:
- Please turn off the TV. / Turn it off.
- She looks after her grandmother.
- I gave up smoking last year. / Wake up!`,

  "Do vs Make": `'Do' for tasks, work, activities: do homework, do the dishes, do exercise, do business, do a favor.
'Make' for creating, producing, or causing: make a cake, make a decision, make a mistake, make money, make friends.
Examples:
- I need to do my homework.
- She made a delicious cake.
- Don't make noise! / Can you do me a favor?`,

  "Uses of 'Get'": `'Get' has many meanings: obtain (get a job), become (get tired), arrive (get home), receive (get a letter), buy (get groceries).
Common expressions: get married, get lost, get ready, get better, get along with.
Examples:
- I got a new phone yesterday.
- She's getting tired.
- What time did you get home? / They got married in June.`,

  "Indefinite Pronouns": `somebody/someone, something, somewhere (affirmative). anybody/anyone, anything, anywhere (questions/negatives). nobody/no one, nothing, nowhere (negative meaning).
everybody/everyone, everything, everywhere (all).
Examples:
- Somebody called you.
- Is there anything I can help with?
- Nobody knows the answer. / Everything is ready.`,

  "Quantifiers (Much, Many, Some, Any)": `'Much' with uncountable (negative/questions). 'Many' with countable (negative/questions).
'Some' in affirmative and offers/requests. 'Any' in questions and negatives.
Examples:
- I don't have much time. / Are there many people?
- Would you like some coffee? (offer)
- Is there any milk left? / I don't have any money.`,

  "Too / Enough": `'Too' + adjective/adverb = more than needed (negative meaning). Adjective/adverb + 'enough' = sufficient.
'Enough' + noun = sufficient amount. Not + adjective + enough = insufficient.
Examples:
- This coffee is too hot to drink.
- She isn't old enough to drive.
- We have enough money for the trip. / He speaks too quickly.`,

  "Possessive Pronouns": `Possessive pronouns replace noun phrases: mine, yours, his, hers, ours, theirs.
They stand alone (no noun after them). Compare with possessive adjectives (my, your, his, her, our, their + noun).
Examples:
- This book is mine. (= my book)
- Is this pen yours?
- Their house is bigger than ours.`,

  "Comparatives & Superlatives": `Comparative: -er/more...than (compares two). Superlative: the -est/the most (compares three+).
Short adj: big → bigger → the biggest. Long adj: beautiful → more beautiful → the most beautiful.
Irregular: good → better → best, bad → worse → worst.
Examples:
- This test is easier than the last one. / This is the easiest test we've had.
- She's more intelligent than her classmates. / She's the most intelligent student.`,

  "So / Neither (Agreement)": `'So + auxiliary + subject' to agree with positive statements. 'Neither + auxiliary + subject' for negative statements.
Match the auxiliary/modal to the original sentence.
Examples:
- "I like pizza." — "So do I."
- "She can swim." — "So can he."
- "I don't eat meat." — "Neither do I."
- "He hasn't been there." — "Neither have we."`,

  "Relative Clauses (Defining)": `Defining relative clauses give essential information about a noun. Use: who (people), which (things), that (people/things), where (places), whose (possession).
No commas. Cannot be removed without changing the meaning.
Examples:
- The woman who lives next door is a doctor.
- I read the book that you recommended.
- That's the restaurant where we had dinner.`,

  "Connectors (However, Although, Because)": `'Because' gives a reason. 'Although/Even though' introduces contrast (unexpected). 'However' shows contrast between sentences.
Examples:
- I stayed home because I was ill.
- Although it was raining, we went for a walk.
- The hotel was expensive. However, the service was excellent.`,

  "Purpose (to / for)": `'To + infinitive' expresses purpose (why someone does something). 'For + noun/gerund' also expresses purpose.
Examples:
- I went to the shop to buy some milk.
- She studies hard to pass the exam.
- This knife is for cutting bread. / I called for information.`,

  "Subject Questions": `In subject questions, the question word IS the subject — no auxiliary needed.
Compare: Who wrote this book? (subject Q) vs What did you write? (object Q).
Examples:
- Who called you? (who = subject)
- What happened? (what = subject)
- Which team won the game?`,

  "Prepositions of Movement": `To (destination), from (origin), into (entering), out of (leaving), through (passing inside), across (from one side to another), along (following a line), past (going by), up/down, over/under.
Examples:
- She walked to the park.
- He ran across the road.
- The cat jumped through the window. / We drove along the coast.`,

  // ===== B1 =====

  "Past Simple vs Present Perfect": `Past Simple: specific finished time (yesterday, in 2020). Present Perfect: no specific time, connected to present (ever, never, already, yet, just).
Examples:
- I visited Rome in 2019. (specific time) / I have visited Rome twice. (experience, no time)
- She finished the report. (done, past) / She has just finished the report. (recent, relevant now)`,

  "Present Perfect Continuous": `Structure: Subject + have/has + been + verb-ing.
Use for actions that started in the past and continue now (duration with for/since), or recent actions with visible results.
Examples:
- I have been studying for three hours.
- She has been living here since 2015.
- It has been raining — the ground is wet.`,

  "Future Forms Review": `Will: spontaneous decisions, predictions. Going to: plans, evidence-based predictions. Present Continuous: fixed arrangements. Present Simple: timetables/schedules.
Examples:
- I'll call you later. (spontaneous)
- I'm going to start a new course. (plan)
- We're meeting at 6. (arrangement)
- The train leaves at 8:30. (timetable)`,

  "Obligation & Advice (Must, Should, Ought to)": `Must: strong personal obligation or strong recommendation. Should/Ought to: advice, suggestion.
Mustn't: prohibition. Don't have to: no obligation.
Examples:
- You must wear a seatbelt. (obligation)
- You should drink more water. (advice)
- You ought to apologize. / You mustn't use your phone in the exam.`,

  "Ability (Can, Could, Be able to)": `Can: present ability. Could: past general ability. Was/were able to: past specific achievement.
Be able to: used in tenses where can/could don't work (future, perfect).
Examples:
- I can speak three languages.
- She could swim when she was five.
- He was able to finish the race despite his injury.
- I will be able to help you tomorrow.`,

  "Deduction (Must, Might, Can't)": `Must: strong positive deduction (I'm almost certain). Might/May: possible but uncertain. Can't: strong negative deduction (impossible).
Examples:
- She must be at home — her car is outside.
- He might be ill — he didn't come to work.
- That can't be true — I don't believe it.`,

  "Had better / Would rather": `'Had better' + base verb: strong advice/warning (or else bad consequences). 'Would rather' + base verb: preference.
Negative: had better not / would rather not.
Examples:
- You'd better hurry or you'll miss the bus.
- I'd rather stay home tonight.
- She'd better not be late again. / Would you rather have tea or coffee?`,

  "Used to / Be used to / Get used to": `'Used to + base verb': past habit no longer true. 'Be used to + noun/gerund': accustomed to something. 'Get used to + noun/gerund': becoming accustomed.
Examples:
- I used to smoke, but I stopped.
- She is used to working long hours.
- He is getting used to the cold weather.`,

  "Zero & First Conditional": `Zero: If + Present Simple, Present Simple — for general truths and facts. First: If + Present Simple, will + base verb — for real/likely future situations.
Examples:
- If you heat water to 100°C, it boils. (zero — always true)
- If it rains tomorrow, I'll stay home. (first — real possibility)
- If you mix red and blue, you get purple. (zero)`,

  "Third Conditional": `Structure: If + Past Perfect, would have + past participle.
Use for unreal past situations — imagining a different past and its result.
Examples:
- If I had studied harder, I would have passed the exam.
- If she hadn't missed the bus, she wouldn't have been late.
- We would have gone to the beach if the weather had been nicer.`,

  "Passive Voice (Intermediate)": `Passive can be used in any tense: be + past participle.
Present Perfect Passive: has/have been + pp. Future Passive: will be + pp. Modal Passive: modal + be + pp.
Examples:
- The report has been finished.
- The new bridge will be opened next month.
- This problem can be solved easily.`,

  "Reported Speech (Statements)": `Change tense one step back when reporting: Present → Past, Past → Past Perfect, will → would.
Change pronouns and time expressions accordingly.
Examples:
- "I am tired." → She said (that) she was tired.
- "I will call you." → He said he would call me.
- "I bought a car." → She said she had bought a car.`,

  "Reported Speech (Questions)": `Reported questions use statement word order (no auxiliary inversion). Use 'if/whether' for yes/no questions.
Examples:
- "Where do you live?" → She asked me where I lived.
- "Do you like coffee?" → He asked if I liked coffee.
- "What time does the train leave?" → She asked what time the train left.`,

  "Gerund vs Infinitive": `Some verbs take gerund: enjoy, avoid, mind, finish, suggest, keep. Some take infinitive: want, decide, hope, plan, learn, agree, refuse.
Some take both with no change: like, love, hate, start, begin. Others change meaning with each (stop, remember, try, forget).
Examples:
- I enjoy swimming. / I want to swim.
- She stopped smoking. (quit) / She stopped to smoke. (paused in order to smoke)`,

  "Phrasal Verbs (Common)": `Phrasal verbs combine a verb with a particle to create new meaning. They are very common in everyday English.
Common ones: look up (search), give up (stop trying), put off (postpone), turn down (reject), come across (find by chance), get over (recover), set up (establish).
Examples:
- I looked up the word in the dictionary.
- Don't give up — keep trying!
- She put off the meeting until next week.`,

  "Verb + Preposition": `Many verbs require a specific preposition: depend on, believe in, listen to, look at, think about, wait for, agree with, belong to, apologize for.
Examples:
- It depends on the weather.
- I don't agree with you.
- She apologized for being late. / We're waiting for the bus.`,

  "Articles (Definite, Indefinite, Zero)": `'A/an' (indefinite): first mention, any one of a kind. 'The' (definite): specific, known, unique, second mention. Zero article: general plural/uncountable, names, meals.
Examples:
- I saw a dog in the park. The dog was very friendly.
- The sun rises in the east.
- I like music. / She plays tennis. / Let's have lunch.`,

  "Quantifiers (All, Both, Either, Neither)": `All: everything/everyone in a group. Both: two things/people together. Either: one or the other (of two). Neither: not one or the other (of two).
Examples:
- All students must take the exam.
- Both answers are correct.
- You can sit on either side.
- Neither option is good enough.`,

  "Reflexive Pronouns": `Reflexive pronouns: myself, yourself, himself, herself, itself, ourselves, yourselves, themselves.
Use when subject and object are the same, or for emphasis.
Examples:
- She hurt herself while cooking.
- I taught myself to play guitar.
- He did it himself. (emphasis)`,

  "Adjectives ending in -ed / -ing": `-ed adjectives describe how someone feels: bored, tired, interested, excited, confused.
-ing adjectives describe the thing/person causing the feeling: boring, tiring, interesting, exciting, confusing.
Examples:
- The film was boring. I was bored.
- The news is exciting. She is excited.
- This exercise is confusing. I'm confused.`,

  "So vs Such": `'So' + adjective/adverb: It was so cold. 'Such' + (adjective) + noun: It was such a cold day.
'So...that' and 'such...that' show result.
Examples:
- She is so kind!
- It was such a beautiful sunset.
- He was so tired that he fell asleep immediately.
- It was such a difficult exam that nobody passed.`,

  "Comparison (Advanced)": `as...as (equal): She is as tall as her brother. not as...as (unequal): He isn't as fast as her.
the + comparative...the + comparative: The more you practice, the better you get.
comparative + and + comparative: It's getting colder and colder.
Examples:
- This book is as interesting as that one.
- The older I get, the wiser I become.
- The weather is getting worse and worse.`,

  "Relative Clauses (Defining vs Non-defining)": `Defining: essential info, no commas, who/which/that. Non-defining: extra info, WITH commas, who/which (NOT that).
Examples:
- The man who called you is my brother. (defining — which man?)
- My brother, who lives in London, is visiting us. (non-defining — extra info)
- The book that I read was great. / Paris, which is the capital of France, is beautiful.`,

  "Question Tags": `Short questions at the end of a sentence to confirm information. Positive statement → negative tag. Negative statement → positive tag.
Match the auxiliary verb and tense.
Examples:
- You are a student, aren't you?
- She doesn't like fish, does she?
- They have been here before, haven't they?
- Let's go, shall we?`,

  "Connectors of Purpose & Reason": `Purpose: to/in order to/so as to + infinitive, so that + clause. Reason: because, as, since, due to, because of.
Examples:
- I went to the library to study.
- She left early so that she wouldn't miss the train.
- He was late because of the traffic.
- Since it was raining, we stayed inside.`,

  // ===== B2 =====

  "Narrative Tenses": `Combine Past Simple, Past Continuous, and Past Perfect to tell stories.
Past Simple: main events. Past Continuous: background/setting. Past Perfect: earlier events.
Examples:
- I was walking home when I saw an old friend. We hadn't seen each other for years.
- She opened the door and realized someone had been there.
- The sun was shining and birds were singing when the alarm went off.`,

  "Future Continuous": `Structure: Subject + will be + verb-ing.
Use for actions in progress at a specific future time, or to ask about plans politely.
Examples:
- This time tomorrow, I'll be flying to Paris.
- Will you be using the car tonight?
- At 8 pm, she'll be having dinner with her parents.`,

  "Future Perfect": `Structure: Subject + will have + past participle.
Use for actions completed before a specific future time.
Examples:
- By next year, I will have finished my degree.
- She will have left by the time you arrive.
- They won't have completed the project by Friday.`,

  "Past Modals (Should have / Could have)": `'Should have + pp': criticism or regret about the past (the right thing wasn't done). 'Could have + pp': a past possibility that didn't happen.
Examples:
- You should have told me earlier. (but you didn't)
- She could have passed the exam if she had studied. (but she didn't)
- I shouldn't have eaten so much. / He could have helped us.`,

  "Deduction (Must have / Can't have)": `'Must have + pp': strong deduction about a past event (I'm almost certain it happened). 'Can't have + pp': strong deduction that it didn't happen.
May/might have + pp: uncertain deduction about the past.
Examples:
- She must have forgotten about the meeting.
- He can't have finished already — it's impossible!
- They might have taken the wrong road.`,

  "Habits (Will / Would for habits)": `'Will/won't' for typical present habits (often with characteristic behavior). 'Would' for past habits (similar to 'used to' but only for repeated actions, not states).
Examples:
- She'll always arrive late — it's just who she is.
- He won't eat vegetables no matter what.
- When I was a child, I would play in the garden every day.`,

  "Third Conditional (Review)": `Structure: If + Past Perfect, would/could/might have + past participle.
Expresses unreal past situations and their imagined consequences.
Examples:
- If I had known, I would have helped.
- If they had left earlier, they wouldn't have missed the flight.
- She might have survived if the ambulance had arrived sooner.`,

  "Mixed Conditionals": `Mix of 2nd and 3rd conditional. Past condition → present result: If + Past Perfect, would + base verb. Present condition → past result: If + Past Simple, would have + pp.
Examples:
- If I had studied medicine, I would be a doctor now. (past condition → present result)
- If she spoke better English, she would have got the job. (present condition → past result)
- If we hadn't moved here, we wouldn't know each other.`,

  "Wishes & Regrets (I wish / If only)": `'I wish / If only + Past Simple': wish about present (unreal now). 'I wish / If only + Past Perfect': regret about past. 'I wish + would': wish for someone to change behavior.
Examples:
- I wish I had more free time. (present — but I don't)
- If only I had studied harder. (past regret)
- I wish you would stop making noise. (annoying behavior)`,

  "Passive (Advanced Structures)": `Advanced passive: It + passive reporting verb + that clause. Subject + passive reporting verb + to infinitive.
Common verbs: believe, think, say, know, report, expect, consider.
Examples:
- It is believed that the economy will improve.
- The suspect is known to have left the country.
- She is said to be the best candidate.`,

  "Causative (Have something done)": `Structure: have/get + object + past participle.
Use when someone else does something for you (you arrange/pay for a service).
Examples:
- I had my hair cut yesterday.
- She's getting her car repaired.
- We need to have the house painted.`,

  "Reporting Verbs (Passive)": `Use reporting verbs in passive structures for formal/impersonal statements.
verb + object + to infinitive: advise, encourage, warn, remind, persuade, order.
verb + gerund: suggest, recommend, deny, admit.
verb + that clause: claim, explain, agree, insist.
Examples:
- She advised me to see a doctor.
- He denied stealing the money.
- They claimed that they were innocent.`,

  "Gerund vs Infinitive (Meaning Change)": `Some verbs change meaning depending on gerund vs infinitive.
stop + gerund: quit doing. stop + infinitive: pause to do. remember + gerund: recall past. remember + infinitive: not forget to do.
try + gerund: experiment. try + infinitive: make an effort. forget, regret follow similar patterns.
Examples:
- I stopped smoking. (quit) / I stopped to smoke. (paused to have a cigarette)
- I remember locking the door. (I recall) / Remember to lock the door. (don't forget)`,

  "Verbs of the Senses": `Verbs: see, hear, feel, watch, notice + object + bare infinitive (complete action) or + object + -ing (action in progress).
Examples:
- I saw him cross the road. (complete action)
- I saw him crossing the road. (in progress)
- She heard someone singing. / I felt the ground shake.`,

  "Participle Clauses (Reduced)": `Replace relative/adverbial clauses with participle clauses for conciseness.
Present participle (-ing) for active. Past participle (-ed/irregular) for passive.
Examples:
- The man standing at the door is my uncle. (= who is standing)
- Feeling tired, she went to bed early. (= Because she felt tired)
- Written in 1925, the novel is still popular. (= which was written)`,

  "Adjective Order": `Order: Opinion → Size → Age → Shape → Color → Origin → Material → Purpose + NOUN.
Examples:
- A beautiful big old round brown French wooden dining table.
- She wore a lovely long red silk dress.
- He bought a small new black Italian leather bag.`,

  "Gradable vs Non-gradable Adjectives": `Gradable: can be modified by very, quite, rather, extremely (big, cold, happy). Non-gradable (extreme/absolute): use absolutely, completely, utterly (enormous, freezing, delighted).
Don't say "very enormous" or "very freezing."
Examples:
- It's very cold today. / It's absolutely freezing. (NOT very freezing)
- She was quite tired. / She was completely exhausted.
- The film was really good. / The film was absolutely brilliant.`,

  "Quantifiers (Advanced)": `'Plenty of' (more than enough), 'a great deal of' (uncountable), 'a large number of' (countable), 'hardly any' (almost none), 'the majority of', 'a minority of'.
Each/every (individual), whole/entire (complete).
Examples:
- There are plenty of seats available.
- A great deal of research has been done.
- Hardly any students passed the exam.`,

  "Relative Clauses (Non-defining)": `Non-defining relative clauses add extra, non-essential information. Always use commas. Use who (people), which (things). NEVER use 'that'.
'Which' can refer to a whole clause.
Examples:
- My sister, who is a nurse, lives in London.
- The book, which I bought last week, is very good.
- He passed the exam, which surprised everyone.`,

  "Connectors of Contrast (Despite / In spite of)": `'Despite / In spite of' + noun/gerund: show contrast. 'Although / Even though' + clause.
'However / Nevertheless / Nonetheless': contrast between sentences.
Examples:
- Despite the rain, we went out.
- In spite of being tired, she finished the report.
- Although he worked hard, he didn't pass.
- The hotel was expensive. Nevertheless, we enjoyed our stay.`,

  "Inversion (Introduction)": `Inversion = auxiliary before subject for emphasis (literary/formal style).
After negative/restrictive adverbs: Never, Rarely, Seldom, Not only, No sooner...than, Hardly...when.
Examples:
- Never have I seen such a beautiful sunset.
- Not only did she win, but she also broke the record.
- Rarely does he make mistakes.`,

  "Cleft Sentences (What I need is...)": `Cleft sentences emphasize a specific part of the sentence.
'It is/was...that/who': It was John who broke the window. 'What...is/was': What I need is a holiday.
'The thing that / The reason why / The place where / All I want is...'
Examples:
- It was the noise that woke me up.
- What I like about this city is the food.
- All she wants is some peace and quiet.`,

  // ===== C1 =====

  "Future in the Past": `Use 'was/were going to', 'was/were about to', 'would' to talk about the future as seen from a past perspective.
Examples:
- I was going to call you, but I forgot.
- She was about to leave when the phone rang.
- He said he would help us the next day.`,

  "Wishes & Unreal Past (It's time / I'd rather)": `'It's time / It's high time + Past Simple' = something should happen now but hasn't. 'I'd rather + Past Simple' = preference about someone else's action.
Examples:
- It's time we left. (we should leave now)
- It's high time the government did something about pollution.
- I'd rather you didn't smoke in here.`,

  "Speculation & Deduction (Advanced)": `Layered speculation: must/can't/may/might/could + be + -ing (about now), + have been + -ing (about past continuous).
Examples:
- She must be working late — her office light is still on.
- He can't have been paying attention — he missed the announcement.
- They could have been waiting for hours.`,

  "Inverted Conditionals (Should / Had / Were)": `Formal conditional structures without 'if': Should + subject (= If...should), Had + subject + pp (= If...had), Were + subject + to (= If...were to).
Examples:
- Should you need any help, don't hesitate to ask. (= If you should need)
- Had I known earlier, I would have acted differently. (= If I had known)
- Were she to accept the offer, everything would change. (= If she were to)`,

  "Alternatives to 'If' (Provided / Unless)": `'Provided/providing (that)': on the condition that. 'Unless': if not. 'As long as': on the condition. 'Suppose/supposing': what if. 'On condition that'.
Examples:
- You can go out provided you finish your homework.
- Unless you hurry, you'll miss the train.
- I'll lend you the money as long as you pay me back.
- Suppose you lost your job — what would you do?`,

  "Passive with Reporting Verbs (It is said that...)": `Structure 1: It + passive reporting verb + that clause. Structure 2: Subject + passive reporting verb + to infinitive.
Verbs: say, believe, think, know, report, expect, consider, understand, allege.
Examples:
- It is said that he is the richest man in town. / He is said to be the richest man in town.
- It is believed that the company will close. / The company is believed to be closing.
- She is thought to have left the country.`,

  "Passive with Two Objects": `Some verbs take two objects (give, send, tell, offer, show, teach). Either object can become the subject of the passive.
Examples:
- Active: They gave him a prize. → Passive: He was given a prize. / A prize was given to him.
- Active: She sent me a letter. → Passive: I was sent a letter. / A letter was sent to me.`,

  "Complex Gerunds & Infinitives": `Perfect gerund: having + pp (Having finished work, she went home). Perfect infinitive: to have + pp (She seems to have forgotten).
Passive gerund: being + pp. Passive infinitive: to be + pp.
Examples:
- Having completed the course, he got a certificate.
- She denied having seen him.
- He expects to be promoted. / I don't like being interrupted.`,

  "Subjunctive Mood": `Use the base form of the verb after certain verbs/expressions: suggest, recommend, insist, demand, propose, request, it is essential/vital/important that.
Examples:
- I suggest that she take the earlier flight. (NOT takes)
- It is essential that he be present at the meeting.
- The doctor recommended that she rest for a week.`,

  "Compound Nouns & Possessives": `Compound nouns: noun + noun (bus stop), adj + noun (blackboard), or verb + noun (swimming pool).
Possessive 's: people, animals, time (John's car, today's news). 'Of' for things (the door of the house).
Examples:
- The city centre / a football match / a two-hour delay.
- My sister's husband / the children's toys.
- The end of the road / the results of the experiment.`,

  "Reflexive & Reciprocal Pronouns": `Reflexive: myself, yourself, etc. = same person. Reciprocal: each other, one another = two or more doing to each other.
Examples:
- She taught herself to play piano. (reflexive — same person)
- They looked at each other and smiled. (reciprocal — mutual action)
- We introduced ourselves. / The two teams congratulated one another.`,

  "Compound Adjectives": `Formed by combining words: noun + adj (sugar-free), adj + noun + -ed (blue-eyed), adv + pp (well-known), number + noun (three-year-old).
Always hyphenated before a noun.
Examples:
- a well-known author / a five-star hotel
- a hard-working student / a good-looking man
- a time-consuming task / a heart-breaking story`,

  "Modifying Comparatives (Far / Way / Slightly)": `Intensify comparatives: far, much, way, a lot, considerably + comparative (far better, much worse).
Weaken comparatives: a bit, a little, slightly + comparative (slightly older, a bit cheaper).
Examples:
- This version is far better than the original.
- She's a lot more experienced than her colleague.
- It's slightly warmer today. / The new model is way more expensive.`,

  "Inversion (Negative Adverbials)": `After negative/restrictive adverbs at the start, invert subject and auxiliary.
Never, rarely, seldom, hardly, scarcely, barely, not only, no sooner, at no time, under no circumstances, only when/after/by.
Examples:
- Not only did he apologize, but he also offered compensation.
- No sooner had we arrived than it started raining.
- Under no circumstances should you touch this switch.
- Only by working together can we solve this problem.`,

  "Cleft Sentences (It was... / What I need...)": `'It' clefts (It is/was + focus + that/who): emphasize the new/contrasting information. 'Wh-' clefts (What + clause + is/was): emphasize the action or thing.
All/The thing/The reason/The place + relative clause.
Examples:
- It was Sarah who told me the news. (emphasis on Sarah)
- What surprised me was his reaction. (emphasis on the surprise)
- The reason I called is that I need your help.
- All I want is a quiet evening.`,

  "Participle Clauses": `Present participle (-ing) for simultaneous or causal active actions. Past participle (-ed/irregular) for passive meaning. Having + pp for completed earlier actions.
Examples:
- Walking along the beach, she found a shell. (= While she was walking)
- Exhausted from the journey, they went straight to bed. (= Because they were exhausted)
- Having read the report, he made his decision. (= After he had read)`,

  "Ellipsis & Substitution": `Ellipsis: omitting words to avoid repetition. Substitution: using a word (so, do, one, not) to replace a phrase.
Examples:
- "Are you coming?" "I'd like to." (ellipsis: to come is omitted)
- She asked me to help, and I did. (substitution: did = helped)
- "Will it rain?" "I hope not." (substitution: not = that it won't rain)
- I need a pen. Do you have one? (substitution: one = a pen)`,

  "Discourse Markers": `Words/phrases that organize and connect spoken or written discourse.
Adding: moreover, furthermore, in addition, besides. Contrasting: however, nevertheless, on the other hand. Sequencing: firstly, then, finally. Concluding: in conclusion, to sum up, overall. Exemplifying: for instance, such as.
Examples:
- The plan has several advantages. Moreover, it is cost-effective.
- On the other hand, there are some risks involved.
- To sum up, the project was a success.`,
};
