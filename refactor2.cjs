const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const useMemoStart = '  const LevelSection = useMemo(() => {';
const useMemoEnd = '  }, [isWarningMode, currentLevelIndex, currentLevel, nextLevel, questionsToNext, setShowImageViewer, setShowLevelMap, displayVariant, unlockedVariants.length, setShowVariantModal]);\n';

const startIndex = content.indexOf(useMemoStart);
const endIndex = content.indexOf(useMemoEnd) + useMemoEnd.length;

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + content.substring(endIndex);
}

const levelSectionUsage = `<LevelSection />`;
const levelSectionReplacement = `<LevelSection
              currentLevel={currentLevel}
              currentLevelIndex={currentLevelIndex}
              displayVariant={displayVariant}
              isWarningMode={isWarningMode}
              nextLevel={nextLevel}
              questionsToNext={questionsToNext}
              unlockedVariantsCount={unlockedVariants.length}
              setShowImageViewer={setShowImageViewer}
              setShowVariantModal={setShowVariantModal}
              setShowLevelMap={setShowLevelMap}
            />`;

content = content.split(levelSectionUsage).join(levelSectionReplacement);

fs.writeFileSync('src/App.tsx', content);
console.log('Successfully updated LevelSection usage in App.tsx');
