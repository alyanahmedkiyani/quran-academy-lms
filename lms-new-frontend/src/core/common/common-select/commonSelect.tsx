import React, { useEffect, useState } from "react";
import Select from "react-select";

export type Option = {
  value: string;
  label: string;
};

export interface SelectProps {
  options: Option[];
  defaultValue?: Option;
  value?: Option | null;
  className?: string;
  styles?: any;
  isClearable?: boolean;
  isDisabled?: boolean;
  onChange?: (option: Option | null) => void;
  placeholder?: string;
}

const CommonSelect: React.FC<SelectProps> = ({
  options,
  defaultValue,
  value,
  className,
  styles,
  isClearable = false,
  isDisabled = false,
  onChange,
  placeholder = "Select",
}) => {
  const [selectedOption, setSelectedOption] = useState<Option | undefined>(value ?? defaultValue);

  const customStyles = {
    option: (base: any, state: any) => ({
      ...base,
      color: "#6C7688",
      backgroundColor: state.isSelected ? "#ddd" : "white",
      cursor: "pointer",
      "&:hover": {
        backgroundColor: state.isFocused ? "#2e37a4" : "white",
        color: state.isFocused ? "#fff" : "#2e37a4",
      },
    }),
  };

  useEffect(() => {
    if (value !== undefined) {
      setSelectedOption(value ?? undefined);
    }
  }, [value]);

  useEffect(() => {
    if (defaultValue && value === undefined) {
      setSelectedOption(defaultValue);
    }
  }, [defaultValue, value]);

  const handleChange = (option: Option | null) => {
    if (value === undefined) {
      setSelectedOption(option ?? undefined);
    }
    onChange?.(option);
  };

  return (
    <Select
      classNamePrefix="react-select"
      className={className}
      styles={styles ?? customStyles}
      options={options}
      instanceId="common-select"
      value={value ?? selectedOption}
      onChange={handleChange}
      isClearable={isClearable}
      isDisabled={isDisabled}
      placeholder={placeholder}
    />
  );
};

export default CommonSelect;
