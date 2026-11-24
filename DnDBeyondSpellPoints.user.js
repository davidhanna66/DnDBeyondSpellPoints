// ==UserScript==
// @name         DnDBeyond Spell Points
// @description  Spell point tracker
// @version      1.4.2
// @author       Mwr247
// @namespace    Mwr247
// @homepageURL  https://github.com/Mwr247/DnDBeyondSpellPoints
// @updateURL    none
// @include      https://www.dndbeyond.com/*characters/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';
  const sp = [
    // Class Level, Sorc Points, Spell Points, Max Slot Level
    [1,0,4,1],
    [2,2,6,1],
    [3,3,14,2],
    [4,4,17,2],
    [5,5,27,3],
    [6,6,32,3],
    [7,7,38,4],
    [8,8,44,4],
    [9,9,57,5],
    [10,10,64,5],
    [11,11,73,6],
    [12,12,73,6],
    [13,13,83,7],
    [14,14,83,7],
    [15,15,94,8],
    [16,16,94,8],
    [17,17,107,9],
    [18,18,114,9],
    [19,19,123,9],
    [20,20,133,9]
  ];
  const sc = [
    // Spell Level, Point Cost, Limit of 1
    [1,2,false],
    [2,3,false],
    [3,5,false],
    [4,6,false],
    [5,7,false],
    [6,8,true],
    [7,10,true],
    [8,11,true],
    [9,13,true]
  ];
  const player = {
    id: location.pathname.split('/characters/')[1].split('/')[0],
    level: 0,
    points: 0,
    maxPoints: 0,
    maxSpellLevel: 0
  };
  let loaded = 5;
  let useSpellPoints = JSON.parse(localStorage.getItem('useSp' + player.id)) || false;
  let mergeSorcPoints = JSON.parse(localStorage.getItem('mergeSp' + player.id)) || false;
  let settingsWarningShown = false;
  const init = () => {
    const content = document.getElementById('character-tools-target');
    if (!content) {return;}
    const caster = ([...content.getElementsByClassName('ddbc-character-summary__classes')].map(ele => ele.innerText) || [])[0]?.split(' / ').filter(val => /Artificer|Bard|Cleric|Druid|Paladin|Ranger|Sorcerer|Wizard/.test(val));
    if (caster && caster.length && !/\/builder/.test(window.location.pathname)) {
      if (!useSpellPoints) {return;}
      const rawMaxPoints = localStorage.getItem('spMax' + player.id) || false;
      console.log('Spell point tracker active');
      console.log('spMax: ' + rawMaxPoints);
      const sorc = caster.find(val => /Sorcerer/.test(val));
      const sorcLvl = sorc != null ? +sorc.split(' ')[1] : 1;
      player.level = Math.ceil(caster.reduce((lvl, val) => lvl + ((val.split(' ')[1] * (1 - 0.5 * /Artificer|Paladin|Ranger/.test(val)))), 0));
      if (rawMaxPoints && rawMaxPoints != -1) {
        player.maxPoints = localStorage.getItem('spMax' + player.id);
      }
      else {
        player.maxPoints = sp[sorcLvl - 1][1] * mergeSorcPoints + sp[player.level - 1][2];
        localStorage.setItem('spMax' + player.id, player.maxPoints);
      }
      player.points = Math.max(player.maxPoints - localStorage.getItem('sp' + player.id) * 1, 0);
      player.maxSpellLevel = sp[player.level - 1][3];
      const setPoints = val => {
        val = Math.max(Math.min(val, player.maxPoints), 0);
        player.points = val;
        localStorage.setItem('sp' + player.id, player.maxPoints - val);
        (document.getElementById('pointsDisplay') || {}).innerText = player.points;
      };
      const setMaxPoints = val => {
        if (val === -1) {
          const normalMaximum = (sp[sorcLvl - 1][1] * mergeSorcPoints + sp[player.level - 1][2]);
          const newPoints = Math.min(player.points, normalMaximum);
          localStorage.setItem('spMax' + player.id, -1);
          localStorage.setItem('sp' + player.id, newPoints);
          player.maxPoints = normalMaximum;
          player.points = newPoints;
          (document.getElementById('pointsDisplay') || {}).innerText = player.points;
          (document.getElementById('pointsDisplayMax') || {}).innerText = '/ ' + player.maxPoints;
        }
        else {
          val = Math.max(val, 1);
          player.maxPoints = val;
          player.points = Math.min(player.maxPoints, player.points);
          localStorage.setItem('sp' + player.id, val - player.points);
          localStorage.setItem('spMax' + player.id, player.maxPoints);
          (document.getElementById('pointsDisplay') || {}).innerText = player.points;
          (document.getElementById('pointsDisplayMax') || {}).innerText = '/ ' + player.maxPoints;
        }
      };
      const cast = level => {
        const cost = sc[level - 1][1];
        return evt => {
          if (player.points >= cost){
            setPoints(player.points - cost);
            console.log('cast level', level, 'spell with', cost, 'points');
          } else {
            alert('Insufficient spell points');
            evt.preventDefault();
            evt.stopPropagation();
            return;
          }
          if (!sc[level - 1][2]) {evt.stopPropagation();}
        };
      };
      if (!content.spCastFlag) {
        content.spCastFlag = true;
        // Capture before the sheet consumes a spell slot or replaces the row.
        content.addEventListener('click', evt => {
          if (!(evt.target instanceof Element)) {return;}
          const button = evt.target.closest('.ct-spells-spell__action > button');
          if (!button || !/\bcast\b/i.test(button.textContent)) {return;}
          const row = button.closest('.ct-spells-spell');
          const source = row?.querySelector('.ct-spells-spell__meta')?.textContent || '';
          if (!/Artificer|Bard|Cleric|Druid|Paladin|Ranger|Sorcerer|Wizard|Psionic Spells/.test(source)) {
            return;
          }
          const group = row.closest('.ct-content-group');
          const heading = group?.querySelector('.ct-content-group__header-content')?.textContent || '';
          if (/^\s*cantrip/i.test(heading)) {return;}
          const match = heading.match(/^\s*([1-9])(?:st|nd|rd|th)?\b/i);
          if (!match) {
            console.warn('Spell point tracker: cannot determine Cast button spell level.', heading);
            return;
          }
          cast(Number(match[1]))(evt);
        }, true);
      }
      const castClick = evt => {
        console.log('checking levels');
        setTimeout(() => {
          [...content.getElementsByClassName('ct-content-group')].forEach(el => {
            if (!/^CANTRIP/.test(el.innerText)) {
              const level = +el.innerText[0];
              console.log('level', level);
              const lvl = el.querySelector('.ct-content-group__header-content');
              if (!lvl.spFlag){
                lvl.spFlag = true;
                lvl.innerText += ' (Cost ' + sc[level - 1][1] + ')';
              }
              [...el.querySelectorAll('.ddbc-spell-damage-effect__damages > .integrated-dice__container')].filter(ele => !ele.evtFlag).forEach(ele => {
                if (ele.closest('.ct-spells-spell')?.querySelector('.ct-spells-spell__action > button')) {
                  return;
                }
                ele.evtFlag = true;
                if (/Artificer|Bard|Cleric|Druid|Paladin|Ranger|Sorcerer|Wizard|Psionic Spells/.test(ele.parentNode.parentNode.innerText)) {
                  ele.addEventListener('click', cast(level));
                }
              });
              [...el.getElementsByClassName('ct-spells-spell')].filter(ele => !ele.evtFlag).forEach(ele => {
                ele.evtFlag = true;
                if (/Artificer|Bard|Cleric|Druid|Paladin|Ranger|Sorcerer|Wizard|Psionic Spells/.test(ele.innerText)) {
                  ele.addEventListener('click', panelOpenClick);
                }
              });
            }
          });
        }, 10);
      };
      const actionCastClick = evt => {
        console.log('checking actions');
        setTimeout(() => {
          [...content.getElementsByClassName('ct-feature-snippet__spell-summary')].filter(ele => !ele.evtFlag).forEach(ele => {
            ele.evtFlag = true;
            if (/Artificer|Bard|Cleric|Druid|Paladin|Ranger|Sorcerer|Wizard|Psionic Spells/.test(ele.innerText)) {
              ele.addEventListener('click', panelOpenClick);
            }
          });
        }, 10);
      };
      const panelOpenClick = evt => {
        console.log('opened panel');
        setTimeout(() => {
          const spDetail = document.getElementsByClassName('ct-spell-detail')[0];
          if (spDetail != null) {
            const spCast = spDetail.querySelector('.ct-spell-caster__casting-action > button');
            spCast.innerHTML = spCast.innerHTML.replace('Spell Slot', 'Spell Points');
            const spLvl = spDetail.getElementsByClassName('ct-spell-caster__casting-level-current')[0];
            const spCost = spDetail.getElementsByClassName('ct-spell-caster__casting-action-count--spellcasting')[0];
            console.log('spell level:', spLvl.innerText[0]);
            spCast.spLvl = spLvl.innerText[0];
            spCost.innerText = sc[+spCast.spLvl - 1][1];
            spCast.addEventListener('click', evt => cast(+spCast.spLvl)(evt));
            [...spDetail.getElementsByClassName('ct-spell-caster__casting-level-action')].forEach(ele => {
              ele.addEventListener('click', evt => {
                setTimeout(() => {
                  console.log('spell level:', spLvl.innerText[0]);
                  spCast.spLvl = spLvl.innerText[0];
                  spCost.innerText = sc[+spCast.spLvl - 1][1];
                }, 10);
              });
            });
          }
        }, 50);
      };
      const actionClick = evt => {
        console.log('clicked actions');
        setTimeout(() => {
          [...content.querySelectorAll('.ct-actions__content .ddbc-tab-options__header')].forEach(ele => ele.addEventListener('click', actionCastClick));
          actionCastClick(evt);
        }, 50);
      };
      const spellClick = evt => {
        console.log('clicked spells');
        setTimeout(() => {
          let tmp = content.getElementsByClassName('ct-spells-level-casting__info-group')[2];
          let pdc = tmp.cloneNode(true);
          pdc.childNodes[1].innerText = 'Spell Points';
          pdc.childNodes[0].childNodes[0].innerText = '';
          let pdSub = document.createElement('span');
          pdSub.innerText = '–';
          pdSub.style.color = '#BB0000';
          pdSub.style.userSelect = 'none';
          pdSub.addEventListener('click', evt => {
            setPoints(player.points - 1);
          });
          pdc.childNodes[0].childNodes[0].appendChild(pdSub);
          let pd = document.createElement('span');
          pd.innerText = player.points;
          pd.id = 'pointsDisplay';
          pd.style.margin = '0 0 0 4px';
          pd.addEventListener('click', evt => {
            let val = prompt('Override Spell Points', player.points);
            if (val == null) {return;}
            else {val = +val;}
            if (val >= 0) {setPoints(val);}
            else {alert('Invalid point value');}
          });
          pdc.childNodes[0].childNodes[0].appendChild(pd);
          let pdMax = document.createElement('span');
          pdMax.innerText = '/ ' + player.maxPoints;
          pdMax.id = 'pointsDisplayMax';
          pdMax.style.margin = '0 4px';
          pdMax.addEventListener('click', evt => {
            let maxVal = prompt('Override Maximum Spell Points (Enter -1 to reset the value)', player.maxPoints);
            if (maxVal == null) { return; }
            else { maxVal = +maxVal; }
            if (maxVal >= 0 || maxVal === -1) { setMaxPoints(maxVal); }
            else { alert('Invalid maximum point value'); }
          });
          pdc.childNodes[0].childNodes[0].appendChild(pdMax);
          let pdAdd = document.createElement('span');
          pdAdd.innerText = '+';
          pdAdd.style.color = '#00BB00';
          pdAdd.style.userSelect = 'none';
          pdAdd.addEventListener('click', evt => {
            setPoints(player.points + 1);
          });
          pdc.childNodes[0].childNodes[0].appendChild(pdAdd);
          tmp.parentNode.appendChild(pdc);
          [...content.querySelectorAll('.ct-spells__content .ddbc-tab-options__header')].forEach(ele => ele.addEventListener('click', castClick));
          content.getElementsByClassName('ct-spells-filter__input')[0].addEventListener('input', castClick);
          castClick(evt);
        }, 50);
      };
      const rest = evt => {
        setPoints(player.maxPoints);
      };
      const restClick = evt => {
        setTimeout(() => {
          document.querySelector('.ct-reset-pane__action .ct-button--confirm').addEventListener('click', rest);
        }, 50);
      };
      [...content.querySelectorAll('.ct-primary-box button')].filter(a => a.innerText.toLowerCase() === 'spells')[0].addEventListener('click', spellClick);
      [...content.querySelectorAll('.ct-primary-box button')].filter(a => a.innerText.toLowerCase() === 'actions')[0].addEventListener('click', actionClick);
      actionClick();
      content.querySelector('.ct-character-header-desktop__group--long-rest .ct-character-header-desktop__button').addEventListener('click', restClick);
      loaded = 0;
    } else if (/\/builder/.test(window.location.pathname)) {
      if (/\/home\/basic\/?$/.test(window.location.pathname) &&
          !content.querySelector('#spell-points-settings')) {
        const anchor = content.querySelector('[data-testid="form-checkbox-group"]') ||
          content.querySelector('[class*="styles_checkboxWrapper__"]');
        if (!anchor) {
          if (!settingsWarningShown) {
            console.warn('Spell point tracker: waiting for settings checkbox markup.');
            settingsWarningShown = true;
          }
          return;
        }
        useSpellPoints = JSON.parse(localStorage.getItem('useSp' + player.id)) || false;
        mergeSorcPoints = JSON.parse(localStorage.getItem('mergeSp' + player.id)) || false;
        const settings = document.createElement('fieldset');
        settings.id = 'spell-points-settings';
        settings.style.cssText = 'margin:16px 0;padding:12px;border:1px solid #888;';
        const heading = document.createElement('legend');
        heading.textContent = 'Spell Points (Tampermonkey)';
        settings.appendChild(heading);
        const addOption = (text, key, checked, onChange) => {
          const label = document.createElement('label');
          label.style.cssText = 'display:flex;align-items:center;gap:8px;margin:8px 0;cursor:pointer;';
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = checked;
          input.style.cssText = 'appearance:auto;position:static;opacity:1;width:18px;height:18px;';
          input.addEventListener('change', () => {
            localStorage.setItem(key + player.id, JSON.stringify(input.checked));
            onChange(input.checked);
          });
          label.append(input, document.createTextNode(text));
          settings.appendChild(label);
        };
        // Keep these controls independent of D&D Beyond's React-owned inputs.
        settings.addEventListener('click', evt => evt.stopPropagation());
        settings.addEventListener('change', evt => evt.stopPropagation());
        addOption('Use Spell Points (Variant Rule)', 'useSp', useSpellPoints,
          checked => { useSpellPoints = checked; });
        addOption('Combine Spell Points with Sorcery Points', 'mergeSp', mergeSorcPoints,
          checked => { mergeSorcPoints = checked; });
        const note = document.createElement('p');
        note.textContent = 'Saved in this browser for this character. Reload the character sheet after changing these options.';
        settings.appendChild(note);
        anchor.before(settings);
      }
      loaded = 0;
    } else {
      if (loaded-- > 0) {
        console.log('attempting to load point tracker...');
        setTimeout(init, 1000);
      }else {
        console.log('point tracker failed to load');
      }
      return;
    }
    console.log('player', player);
  };
  let initializer = null;
  let prevUrl = '';
  const scheduleInit = delay => {
    clearTimeout(initializer);
    initializer = setTimeout(() => {
      initializer = null;
      init();
    }, delay);
  };
  const obs = new MutationObserver(mut => {
    if (location.href !== prevUrl) {
      prevUrl = location.href;
      let delay = 1000;
      if (/\/builder/.test(window.location.pathname) && loaded === 0) {
        delay = 0;
      }
      scheduleInit(delay);
    } else if (/\/builder\/home\/basic\/?$/.test(location.pathname) &&
               !document.getElementById('spell-points-settings') && initializer === null) {
      scheduleInit(100);
    }
  });
  obs.observe(document, {subtree: true, childList: true});
  scheduleInit(1000);
})();
