import moment, { Duration } from 'moment';
import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAsyncEffect } from 'use-async-effect';
import wretch from 'wretch';

import { createStyles, makeStyles } from '@material-ui/styles';

import { kenticoKontent } from '../../appSettings.json';
import * as config from '../../config.json';
import { element as terms } from '../../terms.en-us.json';
import { loadModule } from '../../utilities/modules';
import { Loading } from '../Loading';
import { IGetTypesResponse } from '../shared/IGetTypesResponse';
import { ISyncResponse } from '../shared/ISyncResponse';
import { IContentItem } from '../shared/models/management/IContentItem';
import { IContentType } from '../shared/models/management/IContentType';

const crawlDescendants = (
  element: Element,
  parsers: { attribute: string; value: string; onMatch: (element: Element) => boolean }[]
) => {
  for (const child of element.children) {
    let continueCrawl = true;

    for (const parser of parsers) {
      let attribute = child.getAttribute(parser.attribute);

      if (continueCrawl && attribute && attribute === parser.value) {
        continueCrawl = parser.onMatch(child);
      }
    }

    if (continueCrawl) {
      crawlDescendants(child, parsers);
    }
  }
};

const appendMergeBlock = (element: Element, tag: string, content?: string | null) => {
  if (element.lastElementChild?.tagName.toLowerCase() === tag) {
    element.lastElementChild.textContent = `${element.lastElementChild.textContent}${content}`;
  } else {
    const newElement = document.createElement(tag);

    if (content) {
      newElement.textContent = content;
    }
    element.append(newElement);
  }
};

const appendInline = (element: Element, tag: string, content?: string | null) => {
  let newElement;

  switch (tag) {
    case '':
      newElement = document.createTextNode(content ?? '');
      break;

    default:
      newElement = document.createElement(tag);

      if (content) {
        newElement.textContent = content;
      }
      break;
  }

  appendElementInline(element, newElement);
};

const appendElementInline = (element: Element, child: Element | Text) => {
  if (element.lastElementChild?.tagName.toLowerCase() === 'p') {
    element.lastElementChild.append(child);
  } else {
    const pElement = document.createElement('p');

    pElement.append(child);
    element.append(pElement);
  }
};

const sanitize = (html: string) => {
  const rawDocument = new DOMParser().parseFromString(html, 'text/html');
  const newDocument = document.createElement('div');

  crawlDescendants(rawDocument.documentElement, [
    {
      attribute: 'class',
      value: 'TextRun',
      onMatch: (element) => {
        if (element.textContent === '') {
          return false;
        }

        let styleAttribute = element.getAttribute('style');

        if (styleAttribute) {
          let matchedDeclaration = styleAttribute.match(/font-weight: bold;/);

          if (matchedDeclaration) {
            appendInline(newDocument, 'strong', element.textContent);

            return false;
          }

          matchedDeclaration = styleAttribute.match(/font-style: italic;/);

          if (matchedDeclaration) {
            appendInline(newDocument, 'em', element.textContent);

            return false;
          }
        }

        let descendantMatched = false;

        crawlDescendants(element, [
          {
            attribute: 'data-ccp-charstyle',
            value: 'Heading 1 Char',
            onMatch: (element) => {
              appendMergeBlock(newDocument, 'h1', element.textContent);

              descendantMatched = true;

              return true;
            },
          },
          {
            attribute: 'data-ccp-charstyle',
            value: 'Heading 2 Char',
            onMatch: (element) => {
              appendMergeBlock(newDocument, 'h2', element.textContent);

              descendantMatched = true;

              return true;
            },
          },
          {
            attribute: 'data-ccp-parastyle',
            value: 'heading 1',
            onMatch: (element) => {
              appendMergeBlock(newDocument, 'h1', element.textContent);

              descendantMatched = true;

              return true;
            },
          },
          {
            attribute: 'data-ccp-parastyle',
            value: 'heading 2',
            onMatch: (element) => {
              appendMergeBlock(newDocument, 'h2', element.textContent);

              descendantMatched = true;

              return true;
            },
          },
        ]);

        if (!descendantMatched) {
          appendInline(newDocument, '', element.textContent);
        }

        return true;
      },
    },
    {
      attribute: 'class',
      value: 'Hyperlink',
      onMatch: (element) => {
        const newElement = rawDocument.createElement('a');

        newElement.href = element.getAttribute('href') ?? '';

        const targetAttribute = element.getAttribute('target');

        if (targetAttribute && targetAttribute === '_blank') {
          newElement.dataset.newWindow = 'true';
        }

        newElement.textContent = element.textContent;

        appendElementInline(newDocument, newElement);

        return false;
      },
    },
    {
      attribute: 'class',
      value: 'LineBreakBlob BlobObject DragDrop',
      onMatch: (element) => {
        appendInline(newDocument, 'br');

        return false;
      },
    },
    {
      attribute: 'class',
      value: 'BulletListStyle1',
      onMatch: (element) => {
        const newElement = rawDocument.createElement('ul');

        for (const child of element.children) {
          const newChild = rawDocument.createElement('li');

          crawlDescendants(child, [
            {
              attribute: 'class',
              value: 'TextRun',
              onMatch: (element) => {
                newChild.textContent += element.textContent?.replace(/\p{C}/gu, '') ?? '';

                return false;
              },
            },
          ]);

          newElement.append(newChild);
        }

        newDocument.append(newElement);

        return false;
      },
    },
  ]);

  return newDocument.innerHTML;
};

const useStyles = makeStyles(() =>
  createStyles({
    root: { margin: 16 },
    row: { display: 'flex', flexDirection: 'row', margin: '4px 0' },
    fullWidthCell: { flex: 1 },
    spacer: { flex: 0.1 },
    input: {
      border: 'none',
      width: '100%',
    },
    select: {
      border: 'none',
      color: '#4c4d52',
      width: '100%',
    },
  })
);

export const KontentSync: FC = () => {
  const styles = useStyles();

  const [available, setAvailable] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [allTypes, setAllTypes] = useState<IContentType[]>();
  const [typeId, setTypeId] = useState('');
  const [elementId, setElementId] = useState('');
  const [name, setName] = useState('');

  const [totalApiCalls, setTotalApiCalls] = useState(0);
  const [totalTime, setTotalTime] = useState<Duration>();
  const [newItem, setNewItem] = useState<IContentItem>();
  const [language, setLanguage] = useState('');

  const [error, setError] = useState<string>();

  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initAddin = (info: { host: Office.HostType; platform: Office.PlatformType }) => {
      setAvailable(true);
    };

    loadModule(kenticoKontent.customElementScriptEndpoint, () => Office.onReady(initAddin));
  }, []);

  useAsyncEffect(async () => {
    if (available) {
      setLoading(true);

      const request = wretch(`${config.getTypesEndpoint}`).get().json<IGetTypesResponse>();

      try {
        const response = await request;

        setAllTypes(response.allTypes);
      } catch (error) {
        setError(error.message);
      }

      setLoading(false);
    }
  }, [available]);

  const selectedType = useMemo(() => allTypes?.find((type) => type.id === typeId), [allTypes, typeId]);

  const syncToKontent = useCallback(
    async (richTextValue: string) => {
      const request = wretch(`${config.syncEndpoint}/${config.languageCodename}/${typeId}/${elementId}`)
        .post({
          name,
          richTextValue,
        })
        .json<ISyncResponse>();

      const response = await request;

      setTotalApiCalls(response.totalApiCalls);
      setTotalTime(moment.duration(response.totalMilliseconds));
      setNewItem(response.newItem);
      setLanguage(response.language.id);
    },
    [typeId, elementId, name]
  );

  const syncSelection = useCallback(async () => {
    setLoading(true);
    setLoaded(false);

    try {
      await Word.run(async (context) => {
        const selectedHtml = context.document.getSelection().getHtml();

        await context.sync();

        await syncToKontent(sanitize(selectedHtml.value));
      });
    } catch (error) {
      setError(error.message);

      if (error instanceof OfficeExtension.Error) {
        console.log('Debug info: ' + JSON.stringify(error.debugInfo));
      }
    }

    setLoading(false);
    setLoaded(true);
  }, [syncToKontent]);

  const syncDocument = useCallback(async () => {
    setLoading(true);
    setLoaded(false);

    try {
      await Word.run(async (context) => {
        const selectedHtml = context.document.body.getHtml();

        await context.sync();

        console.log(sanitize(selectedHtml.value));

        await syncToKontent(sanitize(selectedHtml.value));
      });
    } catch (error) {
      setError(error.message);

      if (error instanceof OfficeExtension.Error) {
        console.log('Debug info: ' + JSON.stringify(error.debugInfo));
      }
    }

    setLoading(false);
    setLoaded(true);
  }, [syncToKontent]);

  const getTotalTimeString = useMemo(() => {
    if (totalTime) {
      let result = [];

      if (totalTime.hours() > 0) {
        result.push(`${totalTime.hours()} ${terms.time.hours}`);
      }

      if (totalTime.minutes() > 0) {
        result.push(`${totalTime.minutes()} ${terms.time.minutes}`);
      }

      if (totalTime.seconds() > 0 || totalTime.milliseconds() > 0) {
        result.push(`${totalTime.seconds() + totalTime.milliseconds() / 1000} ${terms.time.seconds}`);
      }

      return result.join(', ');
    }
  }, [totalTime]);

  return (
    <div>
      {loading && <Loading />}
      {available && (
        <div className={styles.root} ref={elementRef}>
          {error && <div>{error}</div>}
          {error === undefined && allTypes && (
            <>
              <div className={styles.row}>
                <div className={styles.fullWidthCell}>
                  <p>{terms.enabledDescription}</p>
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.fullWidthCell}>
                  <input
                    className={styles.input}
                    type='text'
                    placeholder={terms.name}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
              </div>
              <div className={styles.row}>
                <div className={styles.fullWidthCell}>
                  <select className={styles.select} value={typeId} onChange={(event) => setTypeId(event.target.value)}>
                    <option value=''>{terms.chooseType}</option>
                    {allTypes
                      .filter((type) => type.elements.some((element) => element.type === 'rich_text'))
                      .map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name ?? type.codename}
                        </option>
                      ))}
                  </select>
                </div>
                {typeId !== '' && selectedType && (
                  <>
                    <div className={styles.spacer} />
                    <div className={styles.fullWidthCell}>
                      <select
                        className={styles.select}
                        value={elementId}
                        onChange={(event) => {
                          const value = event.target.value;
                          setElementId(value);
                        }}
                      >
                        <option value=''>{terms.chooseElement}</option>
                        {selectedType.elements
                          .filter((currentElement) => currentElement.type === 'rich_text')
                          .map((currentElement) => (
                            <option key={currentElement.id} value={currentElement.id}>
                              {`${currentElement.name ?? currentElement.codename} (${currentElement.type})`}
                            </option>
                          ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
              <div className={styles.row}>
                <div className={styles.fullWidthCell}>
                  <button
                    className='btn btn--primary btn--xs'
                    onClick={syncSelection}
                    disabled={typeId === '' || elementId === ''}
                  >
                    {terms.button}
                  </button>
                  <button
                    className='btn btn--primary btn--xs'
                    onClick={syncDocument}
                    disabled={typeId === '' || elementId === ''}
                  >
                    {terms.buttonAll}
                  </button>
                </div>
              </div>
              {loaded && newItem && totalTime && language && (
                <div className={styles.row}>
                  <div className={styles.fullWidthCell}>
                    <label className='content-item-element__label'>{terms.newItem}</label>
                    <p>
                      <a
                        href={`https://app.kontent.ai/${config.projectId}/content-inventory/${language}/content/${newItem.id}`}
                        target='_blank'
                        rel='noopener noreferrer'
                      >
                        {newItem.name}
                      </a>
                    </p>
                  </div>
                  <div className={styles.fullWidthCell}>
                    <label className='content-item-element__label'>{terms.totalTime}</label>
                    <p>{getTotalTimeString}</p>
                  </div>
                  <div className={styles.fullWidthCell}>
                    <label className='content-item-element__label'>{terms.totalApiCalls}</label>
                    <p>{totalApiCalls}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
