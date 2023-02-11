import Select, { components, SingleValue } from "react-select";

const MenuList = ({ children, ...props }: any) => {
  return (
    <components.MenuList {...props}>
      {Array.isArray(children)
        ? children.slice(0, props.selectProps?.maxOptions)
        : children}
    </components.MenuList>
  );
};

export default function SelectComp({
  games,
  selectedGame,
  setSelectedGame,
}: {
  games: any;
  selectedGame: any;
  setSelectedGame: any;
}) {
  return (
    <Select
      options={games}
      components={{ MenuList }}
      // @ts-ignore
      maxOptions={5}
      value={selectedGame}
      placeholder=""
      onChange={setSelectedGame}
      noOptionsMessage={() => "Игра не найдена"}
      styles={{
        option: (baseStyles, state) => ({
          ...baseStyles,
          color: state.isSelected ? "white" : "black",
        }),
        container: (baseStyles) => ({
          ...baseStyles,
          flex: 1,
        }),
      }}
    />
  );
}
