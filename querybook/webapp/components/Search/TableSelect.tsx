import React, { useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import Select from 'react-select';
import AsyncSelect, { Props as AsyncProps } from 'react-select/async';
import AsyncCreatableSelect from 'react-select/async-creatable';

import {
    MIN_PARTIAL_NAME_LENGTH,
    toContainsPattern,
} from 'lib/elasticsearch/wildcard';
import {
    asyncReactSelectStyles,
    makeReactSelectStyle,
} from 'lib/utils/react-select';
import { queryMetastoresSelector } from 'redux/dataSources/selector';
import { IStoreState } from 'redux/store/types';
import { SearchTableResource } from 'resource/search';
import { overlayRoot } from 'ui/Overlay/Overlay';
import { AccentText } from 'ui/StyledText/StyledText';
import { HoverIconTag } from 'ui/Tag/HoverIconTag';

import './TableSelect.scss';

interface ITableSelectProps {
    tableNames: string[];
    onTableNamesChange: (tableNames: string[]) => void;
    usePortalMenu?: boolean;

    selectProps?: Partial<AsyncProps<any, false>>;

    // remove the selected table name after select
    clearAfterSelect?: boolean;

    // allow entering a partial name, such as "world", instead of only picking
    // from the autocomplete results. The entered text is sent as a "contains"
    // pattern, so any wildcard the user types is matched literally.
    allowPartialName?: boolean;
}

export const TableSelect: React.FunctionComponent<ITableSelectProps> = ({
    tableNames,
    onTableNamesChange,
    usePortalMenu = true,
    selectProps = {},
    clearAfterSelect = false,
    allowPartialName = false,
}) => {
    const queryMetastoreById = useSelector(
        (state: IStoreState) => state.dataSources.queryMetastoreById
    );
    const queryMetastores = useSelector(queryMetastoresSelector);
    const [metastoreId, setMetastoreId] = useState(queryMetastores[0].id);
    const [searchText, setSearchText] = useState('');
    const asyncSelectProps: Partial<AsyncProps<any, false>> = {};
    const tableReactSelectStyle = React.useMemo(
        () => makeReactSelectStyle(usePortalMenu, asyncReactSelectStyles),
        [usePortalMenu]
    );
    if (usePortalMenu) {
        asyncSelectProps.menuPortalTarget = overlayRoot;
    }
    if (clearAfterSelect) {
        asyncSelectProps.value = null;
    }

    const loadOptions = useCallback(
        async (tableName: string) => {
            const { data } = await SearchTableResource.searchConcise({
                metastore_id: metastoreId,
                keywords: tableName,
            });
            const filteredTableNames = data.results.filter(
                (result) =>
                    tableNames.indexOf(`${result.schema}.${result.name}`) === -1
            );
            const tableNameOptions = filteredTableNames.map(
                ({ schema, name }) => ({
                    value: `${schema}.${name}`,
                    label: `${schema}.${name}`,
                })
            );
            return tableNameOptions;
        },
        [metastoreId, tableNames]
    );

    return (
        <div className="TableSelect">
            {queryMetastores.length > 1 && (
                <>
                    <div className="TableSelect-label">metastore</div>
                    <Select
                        styles={tableReactSelectStyle}
                        value={{
                            label: queryMetastoreById[metastoreId].name,
                            value: queryMetastoreById[metastoreId].id,
                        }}
                        onChange={({ value }) => {
                            setMetastoreId(value);
                            onTableNamesChange([]);
                        }}
                        options={queryMetastores.map((metastore) => ({
                            label: metastore.name,
                            value: metastore.id,
                        }))}
                        className="mb8"
                    />
                    <div className="TableSelect-label">tables</div>
                </>
            )}
            <AccentText>
                {(() => {
                    const SelectComponent = allowPartialName
                        ? AsyncCreatableSelect
                        : AsyncSelect;
                    const partialNameProps = allowPartialName
                        ? {
                              // loadOptions runs on every keystroke, and react-select
                              // hides the create option while loading by default
                              allowCreateWhileLoading: true,
                              createOptionPosition: 'first' as const,
                              formatCreateLabel: (input: string) =>
                                  `Match table names containing "${input}"`,
                              isValidNewOption: (input: string) =>
                                  input.trim().length >=
                                  MIN_PARTIAL_NAME_LENGTH,
                          }
                        : {};
                    return (
                        <SelectComponent
                            styles={tableReactSelectStyle}
                            placeholder={
                                allowPartialName
                                    ? 'search table name or partial name'
                                    : 'search table name'
                            }
                            onChange={(option: any) => {
                                // read value, not label: for a created option the
                                // label is the "Match table names containing" text
                                const newTableName = option?.value ?? null;
                                if (newTableName == null) {
                                    onTableNamesChange([]);
                                    return;
                                }
                                // a created option is always a "contains" match,
                                // so send it as a wildcard pattern rather than
                                // having the server guess intent from the text
                                const newTableNames = tableNames.concat(
                                    option.__isNew__
                                        ? toContainsPattern(newTableName)
                                        : newTableName
                                );
                                onTableNamesChange(newTableNames);
                            }}
                            loadOptions={loadOptions}
                            defaultOptions={[]}
                            inputValue={searchText}
                            onInputChange={(text) => setSearchText(text)}
                            noOptionsMessage={() =>
                                searchText ? 'No table found.' : null
                            }
                            {...partialNameProps}
                            {...asyncSelectProps}
                            {...selectProps}
                        />
                    );
                })()}
            </AccentText>
            {tableNames.length ? (
                <div className="mt8">
                    {tableNames.map((tableName) => (
                        <HoverIconTag
                            key={tableName}
                            name={tableName}
                            iconOnHover="X"
                            onIconHoverClick={() => {
                                const newTableNames = tableNames.filter(
                                    (name) => name !== tableName
                                );
                                onTableNamesChange(newTableNames);
                            }}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
};
