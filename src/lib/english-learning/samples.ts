// Sample English passages for the "Try a sample" feature

export interface SampleText {
  title: string;
  difficulty: string;
  topic: string;
  text: string;
}

export const SAMPLE_TEXTS: SampleText[] = [
  {
    title: "The Forest's Quiet Symphony",
    difficulty: "B1",
    topic: "自然",
    text: `Walking through the ancient forest, I was struck by how quiet it was—not the silence of an empty room, but a living, breathing quietude. The moss under my feet softened every step, and the air smelled of pine needles and damp earth. Sunlight filtered through the canopy in slender beams, illuminating motes of dust that drifted lazily between the trees.

A woodpecker drummed somewhere in the distance, its rhythm steady and unhurried. Occasionally a squirrel would dart across the path, pause to assess me with bright, suspicious eyes, and then vanish into the underbrush. These small encounters reminded me that the forest, though seemingly still, was full of invisible lives being lived all at once.

I sat on a fallen log and tried to be as quiet as the trees. After a few minutes, the forest seemed to forget I was there. Birds returned to their songs, and a fox crept cautiously from behind a fern. It is a curious thing: the more we try to be present, the more the world reveals itself to us.`,
  },
  {
    title: "Why We Sleep",
    difficulty: "B2",
    topic: "科普",
    text: `Scientists have long puzzled over why humans spend roughly a third of their lives asleep. From an evolutionary standpoint, sleep seems counterproductive: a sleeping animal is vulnerable to predators and unable to forage or reproduce. Yet every animal studied so far, from fruit flies to whales, exhibits some form of sleep. This suggests sleep serves functions so essential that evolution has preserved it despite the risks.

Recent research points to several critical roles. During deep sleep, the brain consolidates memories, transferring information from short-term to long-term storage. It also clears out metabolic waste that accumulates during waking hours, including proteins associated with Alzheimer's disease. Sleep deprivation, even for a single night, measurably impairs attention, judgment, and emotional regulation.

Despite these findings, modern life often treats sleep as a luxury rather than a necessity. Artificial light, demanding work schedules, and endless entertainment conspire to keep us awake longer than our bodies would prefer. The consequences are far-reaching: chronic sleep loss is linked to obesity, diabetes, cardiovascular disease, and weakened immunity. Recognizing sleep as a biological priority, not an optional indulgence, may be one of the most important public health messages of our time.`,
  },
  {
    title: "The Coffee that Changed My Mornings",
    difficulty: "A2",
    topic: "生活",
    text: `I never used to like coffee. It tasted bitter and strange, and I could not understand why adults drank it every morning. My father would sit at the kitchen table with his old brown cup, smiling as he read the newspaper. "One day you will understand," he always said.

That day came during my first year of university. I had stayed up late studying for an exam, and the next morning I could barely keep my eyes open. My roommate handed me a small cup of black coffee. I took a sip, expecting to hate it. Instead, the warm, slightly bitter drink felt surprisingly comforting. For the first time, I understood what my father meant.

Now, years later, I start every morning with a cup of coffee. It is not just about waking up. It is a small ritual that connects me to my father, to those quiet mornings in the kitchen, and to all the ordinary moments that make a life feel whole.`,
  },
];
