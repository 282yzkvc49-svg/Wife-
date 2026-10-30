// Библиотека знаний. Каждый материал пересказан своими словами по проверенному источнику.
// Дата проверки — когда источник был открыт и сверен. Новые материалы добавлять только после такой же проверки.

export type Evidence = 'strong' | 'consensus' | 'preliminary' | 'insufficient';
export const EVIDENCE_LABEL: Record<Evidence, string> = {
  strong: 'Убедительные доказательства',
  consensus: 'Общепринятая рекомендация с ограничениями',
  preliminary: 'Предварительные исследования',
  insufficient: 'Недостаточно подтверждено',
};

export type ArticleCategory = 'pregnancy' | 'nutrition' | 'produce' | 'protein' | 'vitamins' | 'habits' | 'sleep' | 'activity' | 'yoga' | 'cycle' | 'snacks' | 'safety';
export const CATEGORY_LABEL: Record<ArticleCategory, string> = {
  pregnancy: 'Подготовка к беременности', nutrition: 'Питание', produce: 'Фрукты и овощи', protein: 'Белок и клетчатка',
  vitamins: 'Витамины и нутриенты', habits: 'Привычки', sleep: 'Сон и восстановление', activity: 'Физическая активность',
  yoga: 'Йога', cycle: 'Цикл', snacks: 'Перекусы', safety: 'Безопасность продуктов',
};

export interface Source { title: string; publisher: string; url: string; published: string }
export interface Article {
  id: string;
  title: string;
  categories: ArticleCategory[];
  summary: string;
  practice: string;
  evidence: Evidence;
  limits: string;
  sources: Source[];
  checked: string;
  /** идея привычки, которую можно добавить кнопкой «Добавить в привычки» */
  habitIdea?: string;
  /** показывать прежде всего в режиме беременности */
  pregnancyFocus?: boolean;
}

const CHECKED = '2026-10-30';

export const ARTICLES: Article[] = [
  {
    id: 'folic-acid',
    title: 'Фолиевая кислота до и в начале беременности',
    categories: ['pregnancy', 'vitamins'],
    summary: 'Нервная трубка — зачаток головного и спинного мозга — формируется в первые недели, часто ещё до того, как беременность замечена. Фолиевая кислота, принятая заранее, снижает риск дефектов нервной трубки.',
    practice: 'Принимайте фолиевую кислоту так, как назначил ваш врач, и отмечайте приём в разделе «Мои назначения». Общие рекомендации: CDC — 400 мкг ежедневно минимум за месяц до зачатия; NHS — 400 мкг ежедневно до беременности и до 12-й недели. Части женщин врач назначает более высокую дозу.',
    evidence: 'strong',
    limits: 'Дозировку и длительность определяет врач с учётом вашей ситуации. Приложение не подбирает дозы.',
    sources: [
      { title: 'Folic Acid: Facts for Clinicians', publisher: 'CDC (США)', url: 'https://www.cdc.gov/folic-acid/hcp/clinical-overview/index.html', published: 'проверено в июле 2026' },
      { title: 'Vitamins, supplements and nutrition in pregnancy', publisher: 'NHS (Великобритания)', url: 'https://www.nhs.uk/pregnancy/keeping-well/vitamins-supplements-and-nutrition/', published: 'пересмотрено 1 сентября 2023' },
    ],
    checked: CHECKED,
  },
  {
    id: 'vitamin-d',
    title: 'Витамин D',
    categories: ['vitamins', 'pregnancy'],
    summary: 'Витамин D нужен для обмена кальция и фосфора. Британская служба здравоохранения рекомендует беременным и кормящим 10 мкг в день с сентября по март и предупреждает не превышать 100 мкг (4000 МЕ) в день.',
    practice: 'Если витамин D назначен врачом — принимайте по назначению и отмечайте приём. Если в нескольких добавках есть витамин D, приложение предупредит о возможном дублировании — обсудите это с врачом.',
    evidence: 'consensus',
    limits: 'Потребность зависит от уровня витамина в крови, климата и питания; рекомендации разных стран отличаются.',
    sources: [
      { title: 'Vitamins, supplements and nutrition in pregnancy', publisher: 'NHS (Великобритания)', url: 'https://www.nhs.uk/pregnancy/keeping-well/vitamins-supplements-and-nutrition/', published: 'пересмотрено 1 сентября 2023' },
    ],
    checked: CHECKED,
  },
  {
    id: 'preconception-checks',
    title: 'Что обсудить с врачом до беременности',
    categories: ['pregnancy'],
    summary: 'Перед планированием беременности советуют проверить прививки (в первую очередь от кори, краснухи и паротита), вовремя пройти плановые обследования, начать фолиевую кислоту и витамин D, отказаться от курения и алкоголя, питаться разнообразно и не отменять назначенные лекарства самостоятельно.',
    practice: 'Запишите вопросы к врачу в заметке дня. Если вы принимаете лекарства постоянно, не прекращайте их без разговора с врачом.',
    evidence: 'consensus',
    limits: 'Список обследований зависит от возраста, здоровья и страны; окончательный план — у вашего врача.',
    sources: [
      { title: 'Health checks to have before pregnancy', publisher: 'NHS (Великобритания)', url: 'https://www.nhs.uk/pregnancy/trying-for-a-baby/planning-your-pregnancy/', published: 'пересмотрено 2 июня 2026' },
    ],
    checked: CHECKED,
  },
  {
    id: 'vaccines-before',
    title: 'Прививки до беременности',
    categories: ['pregnancy', 'safety'],
    summary: 'Стоит заранее уточнить защиту от кори, паротита, краснухи и ветряной оспы. Это живые вакцины: после них рекомендуют подождать не меньше 4 недель, прежде чем планировать зачатие. Также обсуждают прививку от гриппа и, при повышенном риске, от гепатита B.',
    practice: 'Спросите врача, нужны ли вам прививки или анализ на антитела. Если прививка нужна, отметьте в календаре дату, после которой можно начинать попытки.',
    evidence: 'consensus',
    limits: 'Схема зависит от прививочного анамнеза и национального календаря.',
    sources: [
      { title: 'Vaccination and pregnancy: Before pregnancy', publisher: 'Правительство Канады, Public Health', url: 'https://www.canada.ca/en/public-health/services/immunization-vaccines/vaccination-pregnancy-before.html', published: 'изменено 13 мая 2026' },
    ],
    checked: CHECKED,
  },
  {
    id: 'fruit-veg',
    title: 'Фрукты и овощи: сколько и зачем',
    categories: ['produce', 'nutrition'],
    summary: 'ВОЗ советует съедать не меньше 400 г фруктов и овощей в день — примерно 5 порций. Разнообразие важнее точного счёта: разные цвета и виды дают разные витамины, минералы и клетчатку.',
    practice: 'Начните с одного шага: фрукт в первой половине дня или овощной гарнир к обеду. Отмечайте фрукты и овощи на главной — приложение покажет, какие виды вы едите чаще.',
    evidence: 'consensus',
    limits: 'Это рекомендация для населения в целом, а не индивидуальная норма.',
    sources: [
      { title: 'Healthy diet', publisher: 'ВОЗ', url: 'https://www.who.int/westernpacific/health-topics/healthy-diet', published: 'страница темы ВОЗ' },
    ],
    checked: CHECKED,
    habitIdea: 'fruit-morning',
  },
  {
    id: 'fibre',
    title: 'Клетчатка без подсчётов',
    categories: ['protein', 'nutrition'],
    summary: 'NHS ориентирует взрослых примерно на 30 г клетчатки в день, а большинство получает около 20 г. Источники: цельнозерновые крупы и хлеб, гречка, булгур, бобовые, овощи, фрукты, орехи и семена.',
    practice: 'Добавьте фасоль, чечевицу или нут в суп или салат раз-два в неделю; выбирайте гречку и булгур как гарнир. Увеличивайте клетчатку постепенно и пейте достаточно воды.',
    evidence: 'consensus',
    limits: 'Приложение не считает граммы клетчатки по дневнику — только ориентиры по разнообразию.',
    sources: [
      { title: 'How to get more fibre into your diet', publisher: 'NHS (Великобритания)', url: 'https://www.nhs.uk/live-well/eat-well/digestive-health/how-to-get-more-fibre-into-your-diet/', published: 'пересмотрено 2 марта 2026' },
    ],
    checked: CHECKED,
  },
  {
    id: 'fish',
    title: 'Рыба: какую и сколько',
    categories: ['protein', 'nutrition', 'safety'],
    summary: 'FDA и EPA советуют тем, кто планирует беременность или беременен, 2–3 порции в неделю рыбы с низким содержанием ртути — например, лосось, минтай, тилапия, креветки, треска, светлый консервированный тунец. Порция — примерно с ладонь. Избегать: королевскую макрель, марлина, большеглазого тунца, акулу, рыбу-меч.',
    practice: 'Если рыба бывает реже раза в неделю, попробуйте тилапию в сливках из ваших любимых блюд или минтай в аэрогриле.',
    evidence: 'consensus',
    limits: 'Местные рекомендации по видам рыбы могут отличаться; NHS при беременности ограничивает жирную рыбу двумя порциями в неделю.',
    sources: [
      { title: 'Advice about Eating Fish', publisher: 'FDA (США)', url: 'https://www.fda.gov/food/consumers/advice-about-eating-fish', published: 'редакция октября 2021, страница от марта 2024' },
    ],
    checked: CHECKED,
  },
  {
    id: 'food-safety-pregnancy',
    title: 'Безопасность продуктов при беременности',
    categories: ['safety', 'pregnancy'],
    summary: 'При беременности советуют избегать непастеризованного молока и сыров, сырого и недожаренного мяса, печени и продуктов из неё, сырой рыбы и моллюсков, рыбы-меч, акулы и марлина; ограничить тунец и жирную рыбу; кофеин — не больше 200 мг в день; алкоголь — исключить.',
    practice: 'Хорошо прожаривайте мясо и яйца, мойте овощи и зелень. В режиме беременности этот материал показывается первым.',
    evidence: 'consensus',
    limits: 'Это рекомендации NHS; ваш врач может дать более точные советы.',
    sources: [
      { title: 'Foods to avoid in pregnancy', publisher: 'NHS (Великобритания)', url: 'https://www.nhs.uk/pregnancy/keeping-well/foods-to-avoid/', published: 'пересмотрено 15 июня 2026' },
    ],
    checked: CHECKED,
    pregnancyFocus: true,
  },
  {
    id: 'honey-sugar',
    title: 'Мёд: что известно',
    categories: ['nutrition', 'habits'],
    summary: 'Убедительных доказательств того, что мёд натощак повышает фертильность, нет. По определению ВОЗ сахара мёда относятся к «свободным сахарам», которые советуют ограничивать до менее 10% калорий в день (а лучше — до 5%).',
    practice: 'Если вам нравится ложка мёда утром — это нормально как часть рациона. В приложении это необязательная привычка, её можно включить или выключить.',
    evidence: 'insufficient',
    limits: 'Утверждение о пользе мёда для фертильности не подтверждено; рекомендация ВОЗ касается сахаров в целом.',
    sources: [
      { title: 'Guideline: Sugars intake for adults and children', publisher: 'ВОЗ (2015), NCBI Bookshelf', url: 'https://www.ncbi.nlm.nih.gov/books/NBK285538/', published: '2015' },
    ],
    checked: CHECKED,
  },
  {
    id: 'activity',
    title: 'Сколько движения достаточно',
    categories: ['activity'],
    summary: 'ВОЗ рекомендует взрослым 150–300 минут умеренной активности в неделю и силовые упражнения 2 дня в неделю. При беременности без противопоказаний — оставаться активной, ориентир не меньше 150 минут умеренной активности в неделю.',
    practice: 'Засчитывается всё: прогулки, йога, разминки на работе. 10 минут ходьбы — уже вклад. Отмечайте прогулки в разделе «Движение».',
    evidence: 'consensus',
    limits: 'Если есть заболевания или беременность с осложнениями, план нагрузок обсуждают с врачом.',
    sources: [
      { title: 'Physical activity — fact sheet', publisher: 'ВОЗ, Европейское бюро', url: 'https://www.who.int/europe/news-room/fact-sheets/item/physical-activity', published: '1 сентября 2021' },
    ],
    checked: CHECKED,
    habitIdea: 'short-walk',
  },
  {
    id: 'yoga-evidence',
    title: 'Йога: что говорят исследования',
    categories: ['yoga', 'activity'],
    summary: 'Обзоры показывают, что йога помогает снижать воспринимаемый стресс и может улучшать сон; для боли в спине польза небольшая. Йога в целом безопасна, если заниматься аккуратно. Новичкам советуют избегать стойки на голове и плечах, позы лотоса, форсированного дыхания и горячей йоги.',
    practice: 'Начните с мягких занятий из каталога по 20–25 минут дважды в неделю. Если что-то вызывает боль — выйдите из позы.',
    evidence: 'preliminary',
    limits: 'Многие исследования небольшие; при беременности нужна оценка врача, следует избегать горячей йоги и долгого лежания на спине.',
    sources: [
      { title: 'Yoga: Effectiveness and Safety', publisher: 'NCCIH, NIH (США)', url: 'https://www.nccih.nih.gov/health/yoga-effectiveness-and-safety', published: 'обновлено в августе 2023' },
    ],
    checked: CHECKED,
  },
  {
    id: 'sleep',
    title: 'Сон и регулярный режим',
    categories: ['sleep'],
    summary: 'Американская академия медицины сна рекомендует взрослым спать не меньше 7 часов. Постоянное время отхода ко сну и подъёма обычно лучше, чем попытки «отоспаться» в выходные.',
    practice: 'Если легли поздно, отметьте «Поздний подъём» — приложение сдвинет утро и не будет считать задачи просроченными.',
    evidence: 'consensus',
    limits: 'Индивидуальная потребность в сне разная.',
    sources: [
      { title: 'How much sleep do I really need?', publisher: 'American Academy of Sleep Medicine', url: 'https://sleepeducation.org/how-much-sleep-do-i-really-need/', published: '17 июля 2025' },
    ],
    checked: CHECKED,
    habitIdea: 'sleep-regular',
  },
  {
    id: 'habits-science',
    title: 'Как формируется привычка',
    categories: ['habits'],
    summary: 'В исследовании Лалли и коллег (2010) действие становилось автоматическим в среднем примерно за 66 дней, а у разных людей — от 18 до более чем 200 дней. Один пропущенный день почти не влиял на результат.',
    practice: 'Добавляйте по одной-две привычки. Если день не задался — выберите короткую версию или просто продолжите завтра: пропуск не перечёркивает прогресс.',
    evidence: 'preliminary',
    limits: 'Небольшая выборка (96 человек); сроки сильно зависят от привычки и человека.',
    sources: [
      { title: 'How are habits formed: Modelling habit formation in the real world', publisher: 'Lally P. et al., European Journal of Social Psychology, 2010', url: 'https://doi.org/10.1002/ejsp.674', published: '2010' },
      { title: 'How to form a habit', publisher: 'British Psychological Society, Research Digest', url: 'https://bps.org.uk/research-digest/how-form-habit', published: '6 октября 2010' },
    ],
    checked: CHECKED,
  },
  {
    id: 'ovulation-tests',
    title: 'Тесты на овуляцию и календарный прогноз',
    categories: ['cycle'],
    summary: 'Тест на овуляцию определяет подъём лютеинизирующего гормона (ЛГ) в моче, который обычно бывает примерно за 1–1,5 дня до овуляции. Он не подтверждает, что овуляция состоялась. Начинать тестирование нужно в правильный день цикла — по инструкции производителя. Календарный прогноз — лишь оценка по прошлым циклам.',
    practice: 'Приложение подскажет ориентировочный день начала тестов по вашему циклу. Сверьтесь с инструкцией вашего теста и записывайте результат.',
    evidence: 'consensus',
    limits: 'При нерегулярном цикле и некоторых состояниях результаты менее надёжны.',
    sources: [
      { title: 'Ovulation (Urine Test)', publisher: 'FDA (США)', url: 'https://www.fda.gov/medical-devices/home-use-tests/ovulation-urine-test', published: 'актуально на 4 февраля 2018' },
    ],
    checked: CHECKED,
  },
  {
    id: 'eyes-screens',
    title: 'Глаза и экраны',
    categories: ['activity', 'habits'],
    summary: 'При долгой работе за экраном люди реже моргают, что усиливает усталость глаз. Помогает правило 20-20-20: каждые 20 минут смотреть примерно 20 секунд на объект вдали (около 6 метров), спокойно моргать, ставить монитор чуть ниже уровня глаз.',
    practice: 'Короткая разминка «Глаза» из раздела «Движение» — 3 минуты в рабочий день.',
    evidence: 'consensus',
    limits: 'Перерывы облегчают усталость, но не лечат близорукость и другие заболевания глаз.',
    sources: [
      { title: 'Digital Eye Strain, Blue Light, and Tips on How to Relieve your Eyes', publisher: 'Brown University Health', url: 'https://www.brownhealth.org/be-well/digital-eye-strain-blue-light-and-tips-how-relieve-your-eyes', published: '21 апреля 2022' },
    ],
    checked: CHECKED,
    habitIdea: 'screen-breaks',
  },
  {
    id: 'snacks',
    title: 'Перекус без чувства вины',
    categories: ['snacks', 'nutrition'],
    summary: 'Перекус — нормальная часть дня. Удобные варианты с пользой: фрукты, овощные палочки, несолёные орехи и семена, йогурт или творог, цельнозерновые хлебцы.',
    practice: 'Раздел «Перекусить сейчас» подбирает вариант по времени и месту. Случайный перекус не нужно ничем «компенсировать».',
    evidence: 'consensus',
    limits: 'Это общие ориентиры; при медицинских ограничениях по питанию следуйте рекомендациям врача.',
    sources: [
      { title: 'How to get more fibre into your diet', publisher: 'NHS (Великобритания)', url: 'https://www.nhs.uk/live-well/eat-well/digestive-health/how-to-get-more-fibre-into-your-diet/', published: 'пересмотрено 2 марта 2026' },
      { title: 'Healthy diet', publisher: 'ВОЗ', url: 'https://www.who.int/westernpacific/health-topics/healthy-diet', published: 'страница темы ВОЗ' },
    ],
    checked: CHECKED,
  },
];
