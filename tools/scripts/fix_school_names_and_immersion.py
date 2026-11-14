import json
import os
import shutil

PINYIN_MAP = {
    '一': 'Yi',
    '万': 'Wan',
    '世': 'Shi',
    '丹': 'Dan',
    '九': 'Jiu',
    '乾': 'Qian',
    '云': 'Yun',
    '休': 'Xiu',
    '伤': 'Shang',
    '光': 'Guang',
    '兑': 'Dui',
    '凌': 'Ling',
    '凝': 'Ning',
    '凤': 'Feng',
    '刀': 'Dao',
    '刃': 'Ren',
    '剑': 'Jian',
    '千': 'Qian',
    '古': 'Gu',
    '合': 'He',
    '圣': 'Sheng',
    '地': 'Di',
    '坎': 'Kan',
    '坤': 'Kun',
    '墨': 'Mo',
    '天': 'Tian',
    '太': 'Tai',
    '妄': 'Wang',
    '妙': 'Miao',
    '宇': 'Yu',
    '宗': 'Zong',
    '定': 'Ding',
    '宫': 'Gong',
    '寂': 'Ji',
    '寒': 'Han',
    '封': 'Feng',
    '山': 'Shan',
    '岚': 'Lan',
    '岳': 'Yue',
    '巽': 'Xun',
    '幻': 'Huan',
    '幽': 'You',
    '庄': 'Zhuang',
    '开': 'Kai',
    '影': 'Ying',
    '律': 'Lu',
    '御': 'Yu',
    '微': 'Wei',
    '心': 'Xin',
    '情': 'Qing',
    '惊': 'Jing',
    '慎': 'Shen',
    '揽': 'Lan',
    '教': 'Jiao',
    '斗': 'Dou',
    '斩': 'Zhan',
    '明': 'Ming',
    '星': 'Xing',
    '景': 'Jing',
    '暗': 'An',
    '曜': 'Yao',
    '月': 'Yue',
    '木': 'Mu',
    '机': 'Ji',
    '杜': 'Du',
    '极': 'Ji',
    '梦': 'Meng',
    '横': 'Heng',
    '止': 'Zhi',
    '正': 'Zheng',
    '死': 'Si',
    '殿': 'Dian',
    '沧': 'Cang',
    '洪': 'Hong',
    '派': 'Pai',
    '涛': 'Tao',
    '渊': 'Yuan',
    '灵': 'Ling',
    '炎': 'Yan',
    '炼': 'Lian',
    '焚': 'Fen',
    '焰': 'Yan',
    '狂': 'Kuang',
    '玄': 'Xuan',
    '生': 'Sheng',
    '白': 'Bai',
    '百': 'Bai',
    '皇': 'Huang',
    '碧': 'Bi',
    '神': 'Shen',
    '离': 'Li',
    '穹': 'Qiong',
    '紫': 'Zi',
    '纵': 'Zong',
    '绛': 'Jiang',
    '缠': 'Chan',
    '网': 'Wang',
    '罗': 'Luo',
    '艮': 'Gen',
    '苍': 'Cang',
    '荒': 'Huang',
    '荡': 'Dang',
    '莲': 'Lian',
    '落': 'Luo',
    '藏': 'Cang',
    '虚': 'Xu',
    '虹': 'Hong',
    '衍': 'Yan',
    '观': 'Guan',
    '谷': 'Gu',
    '赤': 'Chi',
    '辰': 'Chen',
    '道': 'Dao',
    '金': 'Jin',
    '钧': 'Jun',
    '锦': 'Jin',
    '门': 'Men',
    '闪': 'Shan',
    '阁': 'Ge',
    '阙': 'Que',
    '阳': 'Yang',
    '阴': 'Yin',
    '雪': 'Xue',
    '霄': 'Xiao',
    '震': 'Zhen',
    '霜': 'Shuang',
    '霞': 'Xia',
    '霸': 'Ba',
    '青': 'Qing',
    '飞': 'Fei',
    '鬼': 'Gui',
    '魂': 'Hun',
    '魄': 'Po',
    '魔': 'Mo',
    '鸣': 'Ming',
    '鸾': 'Luan',
    '鸿': 'Hong',
    '黄': 'Huang',
    '黯': 'An',
    '龙': 'Long'
}

# Building enhancements for authentic Xianxia atmosphere
BUILDING_FIXES = {
    'schoolBuildingName1005': 'Pavilhão de Cura',         # was 'Hospital'
    'schoolBuildingName1102': 'Pico da Besta Divina',     # was 'Picos Behemoth'
    'schoolBuildingName1103': 'Altar de Nuwa',            # was 'Wahuang Altar'
    'schoolBuildingName1104': 'Terra Sagrada de Cultivo', # was 'Pratique Terra Santa'
    'schoolBuildingName1010': 'Legado da Seita',          # was 'Tradicional'
    'schoolBuildingName1110': 'Torre de Alerta',          # was 'Plataforma Beacon'
    'schoolBuildingName1112': 'Lago das Escamas Verdes',  # was 'Primavera em Escala Verde'
    'schoolBuildingName1008': 'Árvore Sagrada Jianmu',    # was ' Cofre de Árvore'
}

# Suffixes
LAST_FIXES = {
    'school_name_last1': ' Seita',
    'school_name_last2': ' Seita',
    'school_name_last3': ' Seita',
    'school_name_last4': ' Seita',
    'school_name_last5': ' Seita',
    'school_name_last6': ' Seita',
    'schoolLastName1': 'Seita',
    'schoolLastName2': 'Seita',
    'schoolLastName3': 'Seita',
    'schoolLastName4': 'Seita',
    'schoolLastName5': 'Seita',
    'schoolLastName6': 'Seita',
    'schoolLastName7': 'Pavilhão',
    'schoolLastName8': 'Palácio',
    'schoolLastName9': 'Templo',              # was 'Têmpora'
    'schoolLastName10': 'Salão',
    'schoolLastName11': 'Mansão da Montanha',  # was 'Montanha Hamlet'
}

def main():
    # 1. Load original Chinese definitions
    orig_path = r"配置修改教程\配置（只读）Json格式\LocalText.json"
    with open(orig_path, 'r', encoding='utf-8') as f:
        orig_data = json.load(f)
    orig_map = {x['key']: x for x in orig_data}

    # 2. Load target output LocalText.json
    out_path = "output/ModExcel/LocalText.json"
    with open(out_path, 'r', encoding='utf-8') as f:
        out_data = json.load(f)

    modified_count = 0
    changes = []

    for item in out_data:
        key = item.get('key', '')
        orig_item = orig_map.get(key)
        if not orig_item:
            continue

        ch = orig_item.get('ch', '')

        # Check Building Fixes
        if key in BUILDING_FIXES:
            old_val = item.get('en', '')
            new_val = BUILDING_FIXES[key]
            if old_val != new_val:
                item['en'] = new_val
                changes.append((key, old_val, new_val))
                modified_count += 1
            continue

        # Check Last Fixes
        if key in LAST_FIXES:
            old_val = item.get('en', '')
            new_val = LAST_FIXES[key]
            if old_val != new_val:
                item['en'] = new_val
                changes.append((key, old_val, new_val))
                modified_count += 1
            continue

        # Check First parts (Capitalized Pinyin)
        if (key.startswith('schoolNameFirst') or 
            key.startswith('schoolNameFirstFinal') or 
            key.startswith('school_name_first')):
            
            # Special case for Yulong (御龙) if key is schoolNameFirst159
            if key == 'schoolNameFirst159':
                new_val = 'Yulong'
            elif ch in PINYIN_MAP:
                new_val = PINYIN_MAP[ch]
            else:
                continue

            old_val = item.get('en', '')
            if old_val != new_val:
                item['en'] = new_val
                changes.append((key, old_val, new_val))
                modified_count += 1
            continue

        # Check Second parts (Lowercase Pinyin for compound words)
        if (key.startswith('schoolNameSecond') or 
            key.startswith('schoolNameSecondFinal') or 
            key.startswith('school_name_second')):
            
            # Special case for Yulong blank second part
            if key == 'schoolNameSecond159':
                new_val = ''
            elif ch in PINYIN_MAP:
                new_val = PINYIN_MAP[ch].lower()
            else:
                continue

            old_val = item.get('en', '')
            if old_val != new_val:
                item['en'] = new_val
                changes.append((key, old_val, new_val))
                modified_count += 1
            continue

    print(f"Total entries modified: {modified_count}")
    print("\nSample changes:")
    for k, old_val, new_val in changes[:30]:
        print(f"  {k:25}: '{old_val}' -> '{new_val}'")
    for k, old_val, new_val in changes[-15:]:
        print(f"  {k:25}: '{old_val}' -> '{new_val}'")

    # Save to output/ModExcel/LocalText.json
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out_data, f, ensure_ascii=False, indent=2)
    print(f"\nSuccessfully wrote updated LocalText.json to {out_path}")

    # Synchronize to all mod destinations
    sync_targets = [
        r"ModProject_VMCUi0\ModProject\ModExcel\LocalText.json",
        r"ModProject_VMCUi0\debug\Mod_VMCUi0\ModExcel\LocalText.json",
        r"D:\SteamLibrary\steamapps\workshop\content\1468810\2990310797\ModExcel\LocalText.json"
    ]

    for target in sync_targets:
        os.makedirs(os.path.dirname(target), exist_ok=True)
        shutil.copy2(out_path, target)
        print(f"Synced to: {target}")

if __name__ == '__main__':
    main()
